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

// ------------------------------
// 1. ENV + CONSTANTS
// ------------------------------
const RPC_URL = "https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY"; 
const FASTLANE_RELAY_URL = "https://relay.fastlane.tools/submitBundle"; // Example URL
const provider = new JsonRpcProvider(RPC_URL);

// EOA / Signer that will create + sign the dummy tx
const OPPORTUNITY_WALLET_PRIVATE_KEY = "0xYourPrivateKeyHere";
const opportunityWallet = new Wallet(OPPORTUNITY_WALLET_PRIVATE_KEY, provider);

// EOA / Signer that will sign the solver operation
const SOLVER_WALLET_PRIVATE_KEY = "0xAnotherPrivateKeyHere";
const solverWallet = new Wallet(SOLVER_WALLET_PRIVATE_KEY, provider);

// DAppControl, Atlas, and verification addresses from your environment
const dappControlAddr = "0x3e23e4282FcE0cF42DCd0E9bdf39056434E65C1F";
const dAppOpSignerAddr = "0x96D501A4C52669283980dc5648EEC6437e2E6346";
const atlasVerificationAddr = "0xf31cf8740Dc4438Bb89a56Ee2234Ba9d5595c0E9";
const atlasAddr = "0x4A394bD4Bc2f4309ac0b75c052b242ba3e0f32e0";

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

// EIP-712 domain for verifying solver operations
const eip712Domain: TypedDataDomain = {
  name: "AtlasVerification",
  version: "1.0",
  chainId: 137,
  verifyingContract: atlasVerificationAddr,
};

// ------------------------------
// 2. Create the "Dummy" Opportunity Tx
// ------------------------------
async function buildOpportunityTransaction(): Promise<string> {
  const txRequest = {
    from: opportunityWallet.address,
    to: opportunityWallet.address,
    data: "0x",
    value: 0,
    gasLimit: 21000,
    maxFeePerGas: ethers.parseUnits("100", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei")
  };

  const signedTx = await opportunityWallet.signTransaction(txRequest);
  return signedTx;
}

// ------------------------------
// 3. Build the SolverOperation
// ------------------------------
async function buildSolverOperation(
  userOpHash: string,
  bidAmount: bigint,
  maxFeePerGas: bigint,
  maxPriorityFeePerGas: bigint
): Promise<SolverOperation> {
  const searcherAbi = [`function solve()`];
  const iface = new Interface(searcherAbi);
  const solverData = iface.encodeFunctionData("solve");

  const solverOp = OperationBuilder.newSolverOperation({
    from: solverWallet.address,
    to: atlasAddr,
    value: 0n,
    gas: 500000n,
    maxFeePerGas,
    deadline: 0n,
    solver: dAppOpSignerAddr,
    control: dappControlAddr,
    userOpHash,
    bidToken: ethers.ZeroAddress,
    bidAmount,
    data: solverData,
    signature: "0x",
  });

  const signature = await solverWallet.signTypedData(
    solverOp.toEIP712Domain(eip712Domain),
    solverOp.toTypes(),
    solverOp.toStruct()
  );

  solverOp.setField("signature", signature);
  return solverOp;
}

// ------------------------------
// 4. Construct the final "PFL-Bundle" payload
// ------------------------------
interface PFLBundle {
  opportunityTx: string;
  solverOp: SolverOperation;
}

function buildBundle(
  solverOp: SolverOperation,
  opportunityTx: string
): PFLBundle {
  return {
    opportunityTx,
    solverOp,
  };
}

// ------------------------------
// 5. Submit the Bundle
// ------------------------------
async function submitBundle(bundle: PFLBundle) {
  console.log("Submitting bundle to FastLane aggregator...");
  const resp = await axios.post(FASTLANE_RELAY_URL, bundle);
  console.log("Bundle submitted. Relay response:", resp.data);
}

// ------------------------------
// 6. Main Flow
// ------------------------------
async function main() {
  const opportunityRawTx = await buildOpportunityTransaction();
  console.log("Dummy Opportunity Tx (raw):", opportunityRawTx);

  const parsedTx = ethers.Transaction.from(opportunityRawTx);
  const oppTxHash = ethers.keccak256(opportunityRawTx);

  const maxFeePerGas = parsedTx.maxFeePerGas ?? 0n;
  const maxPriorityFeePerGas = parsedTx.maxPriorityFeePerGas ?? 0n;

  const userOpHash: string = await dappControl.getBackrunUserOpHash(
    oppTxHash,
    maxFeePerGas,
    maxPriorityFeePerGas,
    dAppOpSignerAddr
  );
  console.log("Got userOpHash from dAppControl:", userOpHash);

  const solverOp = await buildSolverOperation(
    userOpHash,
    ethers.parseUnits("0.01", "ether"),
    maxFeePerGas,
    maxPriorityFeePerGas
  );

  const bundle = buildBundle(solverOp, opportunityRawTx);
  await submitBundle(bundle);
}

main()
  .then(() => console.log("Done."))
  .catch((err) => console.error(err)); 