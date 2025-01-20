import { ethers } from "ethers";
import { 
  opportunityWallet,
  CHAIN_ID,
  provider
} from "./helpers";

// ------------------------------
// Create the "Dummy" Opportunity Tx
// ------------------------------
export async function buildOpportunityTransaction(): Promise<{
  signedTx: string;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  // Note: Here we are using the current gas prices from the provider however 
  // we could also use a high static value if we want to ensure a certain gas price
  // Fetch current gas prices
  const feeData = await provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error("Could not get current gas prices");
  }

  const maxFeePerGas = feeData.maxFeePerGas;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

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