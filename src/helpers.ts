import {
  Wallet,
  ethers,
  Contract,
  JsonRpcProvider,
} from "ethers";
import { getChainConfig } from '@fastlane-labs/atlas-config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ------------------------------
// ENV + CONSTANTS
// ------------------------------
// Bond and Bid amounts
export const MINIMUM_BOND_AMOUNT = ethers.parseEther("1.5"); // 1.5 MATIC minimum bond
export const DEFAULT_BID_AMOUNT = ethers.parseEther("0.0001"); // 0.0001 MATIC bid

export const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("RPC_URL not found in environment variables");

export const FASTLANE_RELAY_URL = process.env.FASTLANE_RELAY_URL || "https://polygon-rpc.fastlane.xyz/";
export const provider = new JsonRpcProvider(RPC_URL);

// EOA / Signer that will create + sign the dummy tx
export const OPPORTUNITY_WALLET_PRIVATE_KEY = process.env.OPPORTUNITY_WALLET_PRIVATE_KEY;
if (!OPPORTUNITY_WALLET_PRIVATE_KEY) throw new Error("OPPORTUNITY_WALLET_PRIVATE_KEY not found in environment variables");
export const opportunityWallet = new Wallet(OPPORTUNITY_WALLET_PRIVATE_KEY, provider);

// EOA / Signer that will sign the solver operation
export const SOLVER_WALLET_PRIVATE_KEY = process.env.SOLVER_WALLET_PRIVATE_KEY;
if (!SOLVER_WALLET_PRIVATE_KEY) throw new Error("SOLVER_WALLET_PRIVATE_KEY not found in environment variables");
export const solverWallet = new Wallet(SOLVER_WALLET_PRIVATE_KEY, provider);

// Get Polygon chain configuration
export const CHAIN_ID = 137; // Polygon Mainnet
export const chainConfig = getChainConfig(CHAIN_ID);

// Contract addresses from chain config
export const atlasAddr = chainConfig.contracts.atlas;
export const dappControlAddr = "0x3e23e4282FcE0cF42DCd0E9bdf39056434E65C1F"; // PFL-dApp address
export const dAppOpSignerAddr = "0x96D501A4C52669283980dc5648EEC6437e2E6346"; // dAppSigner address

// Get EIP-712 domain from chain config
export const eip712Domain = chainConfig.eip712Domain;

// Atlas ABI
const atlasAbi = [
    {
        inputs: [
            { internalType: "address", name: "account", type: "address" }
        ],
        name: "balanceOfBonded",
        outputs: [
            { internalType: "uint256", name: "", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountToBond", type: "uint256" }
        ],
        name: "depositAndBond",
        outputs: [],
        stateMutability: "payable",
        type: "function"
    },
];

// Create Atlas contract instance with proper typing
export const atlas = new Contract(atlasAddr, atlasAbi, provider) as Contract & {
  balanceOfBonded(account: string): Promise<bigint>;
  depositAndBond(amountToBond: bigint): Promise<any>;
};

// Function to verify network connection
export async function verifyNetwork() {
  const network = await provider.getNetwork();
  console.log("\nConnected to network:", {
    name: network.name,
    chainId: network.chainId
  });

  if (network.chainId !== BigInt(CHAIN_ID)) {
    throw new Error(`Wrong network. Expected chainId ${CHAIN_ID}, got ${network.chainId}`);
  }
}

// Helper: Check and Bond Atlas Balance
export async function ensureAtlasBond(minimumBondAmount: bigint): Promise<void> {
  console.log("\nChecking Atlas bond balance...");
  
  // Check current bond balance
  const currentBond = await atlas.balanceOfBonded(solverWallet.address);
  console.log("Current bond balance:", ethers.formatEther(currentBond), "MATIC");
  console.log("Minimum required:", ethers.formatEther(minimumBondAmount), "MATIC");

  if (currentBond < minimumBondAmount) {
    const bondAmount = minimumBondAmount - currentBond;
    console.log(`Bonding additional ${ethers.formatEther(bondAmount)} MATIC...`);

    // Create new contract instance with signer
    const atlasWithSigner = new Contract(atlasAddr, atlasAbi, solverWallet);

    // Bond additional amount
    const tx = await atlasWithSigner.depositAndBond(bondAmount, {
      value: bondAmount
    });
    console.log("Bond transaction submitted:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Bond transaction confirmed in block:", receipt?.blockNumber);

    // Verify new balance
    const newBond = await atlas.balanceOfBonded(solverWallet.address);
    console.log("New bond balance:", ethers.formatEther(newBond), "MATIC");
  } else {
    console.log("Sufficient bond balance already exists");
  }
} 