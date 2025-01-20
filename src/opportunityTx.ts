import { ethers } from "ethers";
import { 
  opportunityWallet,
  CHAIN_ID,
} from "./helpers";

// ------------------------------
// Create the "Dummy" Opportunity Tx
// ------------------------------
export async function buildOpportunityTransaction(): Promise<{
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