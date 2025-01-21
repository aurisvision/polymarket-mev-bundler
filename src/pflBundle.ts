import {
  ethers,
  Contract,
  Interface,
} from "ethers";
import axios from "axios";
import {
  SolverOperation,
  OperationBuilder
} from "@fastlane-labs/atlas-sdk";
import {
  provider,
  solverWallet,
  dappControlAddr,
  dAppOpSignerAddr,
  atlasAddr,
  eip712Domain,
  FASTLANE_RELAY_URL,
} from "./helpers";

// A snippet of the DAppControl ABI relevant for retrieving the userOpHash
const PFLControlAbi = [
  {
    inputs: [
      { internalType: "bytes32", name: "oppTxHash", type: "bytes32" },
      { internalType: "uint256", name: "oppTxMaxFeePerGas", type: "uint256" },
      { internalType: "uint256", name: "oppTxMaxPriorityFeePerGas", type: "uint256" },
      { internalType: "address",  name: "fastLaneSigner", type: "address" }
    ],
    name: "getBackrunUserOpHash",
    outputs: [{ internalType: "bytes32", name: "userOpHash", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
];

// Create contract instance for reading userOpHash
const dappControl = new Contract(dappControlAddr, PFLControlAbi, provider);

// ------------------------------
// Build the SolverOperation
// ------------------------------
export async function buildSolverOperation(
  userOpHash: string,
  bidAmount: bigint,
  maxFeePerGas: bigint,
  maxPriorityFeePerGas: bigint
): Promise<SolverOperation> {
  // Simple solve() function that does nothing - just for demonstration
  const searcherAbi = [`function solve()`];
  const iface = new Interface(searcherAbi);
  const solverData = iface.encodeFunctionData("solve");

  console.log("\nBuilding solver operation:", {
    from: solverWallet.address,
    to: atlasAddr,
    maxFeePerGas: maxFeePerGas.toString(),
    bidAmount: bidAmount.toString(),
    userOpHash
  });

  const solverOp = OperationBuilder.newSolverOperation({
    from: solverWallet.address,
    to: atlasAddr,
    value: 0n,
    gas: 21000n,  // 21000 is the gas limit for a simple transfer
    maxFeePerGas,    // Using the same maxFeePerGas as the opportunity tx
    deadline: 0n,
    solver: dAppOpSignerAddr,
    control: dappControlAddr,
    userOpHash,
    bidToken: ethers.ZeroAddress,
    bidAmount,
    data: solverData,
    signature: "0x",
  });

  // Get the types and values for EIP-712 signing
  const types = solverOp.toTypedDataTypes();
  const values = solverOp.toTypedDataValues();

  const signature = await solverWallet.signTypedData(
    eip712Domain,
    types,
    values
  );

  solverOp.setField("signature", signature);
  return solverOp;
}

// ------------------------------
// Get UserOpHash from DAppControl
// ------------------------------
export async function getUserOpHash(
  oppTxHash: string,
  maxFeePerGas: bigint,
  maxPriorityFeePerGas: bigint
): Promise<string> {
  // Verify contract is accessible
  const code = await provider.getCode(dappControlAddr);
  if (code === "0x") {
    throw new Error(`No contract found at address ${dappControlAddr}`);
  }
  console.log("\nContract found at", dappControlAddr);

  try {
    const userOpHash = await dappControl.getBackrunUserOpHash(
      oppTxHash,
      maxFeePerGas,
      maxPriorityFeePerGas,
      dAppOpSignerAddr
    );
    console.log("Got userOpHash from dAppControl:", userOpHash);
    return userOpHash;
  } catch (error: any) {
    console.error("\nError calling getBackrunUserOpHash:");
    if (error.data) {
      // If there's revert data, try to decode it
      console.error("Revert data:", error.data);
    }
    throw error;
  }
}

// ------------------------------
// Construct the final "PFL-Bundle" payload
// ------------------------------
interface PFLBundle {
  id: number;
  jsonrpc: string;
  method: string;
  params: string[];
}

export function buildBundle(
  solverOp: SolverOperation,
  opportunityTx: string
): PFLBundle {
  return {
    id: 1,
    jsonrpc: "2.0",
    method: "pfl_addSearcherBundle",
    params: [`${opportunityTx}`, `${JSON.stringify(solverOp.toStruct())}`]
  };
}

// ------------------------------
// Submit the Bundle and Transaction
// ------------------------------
const RETRY_DELAY = 5000; // 5 seconds
const MAX_ATTEMPTS = 3;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function submitBundle(bundle: PFLBundle, opportunityTx: string) {
  let attempts = 0;
  
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`\nAttempt ${attempts}/${MAX_ATTEMPTS} to submit bundle...`);
    
    try {
      // Submit to FastLane
      console.log("Submitting bundle to FastLane aggregator...");
      console.log("Bundle payload:", JSON.stringify(bundle, null, 2));
      
      const resp = await axios.post(FASTLANE_RELAY_URL, bundle);
      console.log("Bundle submitted. Relay response:", resp.data);

      // Check for FastLane errors
      if (resp.data.error) {
        console.error("FastLane submission failed:", resp.data.error);
        if (attempts < MAX_ATTEMPTS) {
          console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
          await sleep(RETRY_DELAY);
          continue;
        }
        throw new Error(`FastLane error: ${resp.data.error.message}`);
      }

      // If we get here, submission was successful
      // Check if transaction exists on chain
      const txHash = ethers.keccak256(opportunityTx);
      const tx = await provider.getTransaction(txHash);
      
      // Notice: This submission is not necessary since fastlane will submit to the network
      // but might be useful depending on the use case
      // Only submit to RPC if transaction doesn't exist
      if (!tx) {
        console.log("\nTransaction not found on chain, submitting to network...");
        const txResponse = await provider.broadcastTransaction(opportunityTx);
        console.log("Transaction submitted:", txResponse.hash);

        // Wait for transaction confirmation
        console.log("\nWaiting for transaction confirmation...");
        const receipt = await txResponse.wait();
        console.log("Transaction confirmed in block:", receipt?.blockNumber);
      } else {
        console.log("\nTransaction already exists on chain:", txHash);
      }

      // If we get here, everything worked
      return;

    } catch (error) {
      console.error(`Error in attempt ${attempts}:`, error);
      if (attempts < MAX_ATTEMPTS) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        throw new Error(`Failed after ${MAX_ATTEMPTS} attempts: ${error}`);
      }
    }
  }
} 