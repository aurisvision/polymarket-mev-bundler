import {
  Wallet,
  ethers,
  Contract,
  Interface,
  TypedDataDomain,
  JsonRpcProvider,
} from "ethers";
import axios from "axios";
import {
  SolverOperation,
  OperationBuilder
} from "@fastlane-labs/atlas-sdk";
import { getChainConfig } from '@fastlane-labs/atlas-config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ------------------------------
// 1. ENV + CONSTANTS
// ------------------------------
const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("RPC_URL not found in environment variables");

const FASTLANE_RELAY_URL = process.env.FASTLANE_RELAY_URL || "https://polygon-rpc.fastlane.xyz/";
const provider = new JsonRpcProvider(RPC_URL);

// EOA / Signer that will create + sign the dummy tx
const OPPORTUNITY_WALLET_PRIVATE_KEY = process.env.OPPORTUNITY_WALLET_PRIVATE_KEY;
if (!OPPORTUNITY_WALLET_PRIVATE_KEY) throw new Error("OPPORTUNITY_WALLET_PRIVATE_KEY not found in environment variables");
const opportunityWallet = new Wallet(OPPORTUNITY_WALLET_PRIVATE_KEY, provider);

// EOA / Signer that will sign the solver operation
const SOLVER_WALLET_PRIVATE_KEY = process.env.SOLVER_WALLET_PRIVATE_KEY;
if (!SOLVER_WALLET_PRIVATE_KEY) throw new Error("SOLVER_WALLET_PRIVATE_KEY not found in environment variables");
const solverWallet = new Wallet(SOLVER_WALLET_PRIVATE_KEY, provider);

// Get Polygon chain configuration
const CHAIN_ID = 137; // Polygon Mainnet
const chainConfig = getChainConfig(CHAIN_ID);

// Function to verify network connection
async function verifyNetwork() {
  const network = await provider.getNetwork();
  console.log("\nConnected to network:", {
    name: network.name,
    chainId: network.chainId
  });

  if (network.chainId !== BigInt(CHAIN_ID)) {
    throw new Error(`Wrong network. Expected chainId ${CHAIN_ID}, got ${network.chainId}`);
  }
}

// Contract addresses from chain config
const atlasAddr = chainConfig.contracts.atlas;
const dappControlAddr = "0x3e23e4282FcE0cF42DCd0E9bdf39056434E65C1F"; // PFL-dApp address
const dAppOpSignerAddr = "0x96D501A4C52669283980dc5648EEC6437e2E6346"; // dAppSigner address

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

// Get EIP-712 domain from chain config
const eip712Domain: TypedDataDomain = chainConfig.eip712Domain;

// ------------------------------
// 2. Create the "Dummy" Opportunity Tx
// ------------------------------
async function buildOpportunityTransaction(): Promise<{
  signedTx: string;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  const maxFeePerGas = ethers.parseUnits("100", "gwei");
  const maxPriorityFeePerGas = ethers.parseUnits("30", "gwei");

  // Base transaction request
  const baseTxRequest = {
    to: opportunityWallet.address,
    value: 0,
    gasLimit: 21000,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId: CHAIN_ID,
  };

  // First populate both transactions
  const hashingTx = await opportunityWallet.populateTransaction({
    ...baseTxRequest,
  });


  console.log("\nBuilding opportunity transaction:", {
    to: hashingTx.to,
    maxFeePerGas: hashingTx.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: hashingTx.maxPriorityFeePerGas?.toString(),
    chainId: hashingTx.chainId,
    actualNonce: hashingTx.nonce,
  });


  // Then sign both transactions
  return {
    signedTx: await opportunityWallet.signTransaction(hashingTx),
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

// ------------------------------
// 3. Build the SolverOperation (this is a dummy searcher which does nothing)
// ------------------------------
async function buildSolverOperation(
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
    gas: 500000n,
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
// 4. Construct the final "PFL-Bundle" payload
// ------------------------------
interface PFLBundle {
  id: number;
  jsonrpc: string;
  method: string;
  params: string[];
}

function buildBundle(
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
// 5. Submit the Bundle and Transaction
// ------------------------------
async function submitBundle(bundle: PFLBundle, opportunityTx: string) {
  // First submit the opportunity transaction to the network
  console.log("\nSubmitting opportunity transaction to network...");
  const txResponse = await provider.broadcastTransaction(opportunityTx);
  console.log("Transaction submitted:", txResponse.hash);
  
  // Then submit the bundle to FastLane
  console.log("\nSubmitting bundle to FastLane aggregator...");
  console.log("Bundle payload:", JSON.stringify(bundle, null, 2));
  
  const resp = await axios.post(FASTLANE_RELAY_URL, bundle);
  console.log("Bundle submitted. Relay response:", resp.data);

  // Wait for transaction confirmation
  console.log("\nWaiting for transaction confirmation...");
  const receipt = await txResponse.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);
}

// ------------------------------
// 6. Main Flow
// ------------------------------
async function main() {
  // Verify network connection first
  await verifyNetwork();

  // Build and get the opportunity transaction with its gas parameters
  const { signedTx: opportunityRawTx, maxFeePerGas, maxPriorityFeePerGas } = await buildOpportunityTransaction();
  console.log("Dummy Opportunity Tx (raw):", opportunityRawTx);
  const oppTxHash = ethers.keccak256(opportunityRawTx);
  console.log("\nDebug values:");
  console.log("oppTxHash:", oppTxHash);
  console.log("maxFeePerGas:", maxFeePerGas.toString());
  console.log("maxPriorityFeePerGas:", maxPriorityFeePerGas.toString());
  console.log("dAppOpSignerAddr:", dAppOpSignerAddr);

  // Verify contract is accessible
  const code = await provider.getCode(dappControlAddr);
  if (code === "0x") {
    throw new Error(`No contract found at address ${dappControlAddr}`);
  }
  console.log("\nContract found at", dappControlAddr);

  let userOpHash: string;
  try {
    userOpHash = await dappControl.getBackrunUserOpHash(
      oppTxHash,
      maxFeePerGas,
      maxPriorityFeePerGas,
      dAppOpSignerAddr
    );
    console.log("Got userOpHash from dAppControl:", userOpHash);
  } catch (error: any) {
    console.error("\nError calling getBackrunUserOpHash:");
    if (error.data) {
      // If there's revert data, try to decode it
      console.error("Revert data:", error.data);
    }
    throw error;
  }

  const solverOp = await buildSolverOperation(
    userOpHash,
    ethers.parseUnits("0.01", "ether"),
    maxFeePerGas,
    maxPriorityFeePerGas
  );

  const bundle = buildBundle(solverOp, opportunityRawTx);
  await submitBundle(bundle, opportunityRawTx);
}

main()
  .then(() => console.log("Done."))
  .catch((err) => console.error(err));