import { ethers } from "ethers";
import { 
  verifyNetwork, 
  ensureAtlasBond, 
  MINIMUM_BOND_AMOUNT,
  DEFAULT_BID_AMOUNT 
} from "./helpers";
import { buildOpportunityTransaction } from "./opportunityTx";
import { 
  buildSolverOperation,
  getUserOpHash,
  buildBundle,
  submitBundle
} from "./pflBundle";

// ------------------------------
// Main Flow
// ------------------------------
async function main() {
  // Verify network connection first
  await verifyNetwork();

  // Ensure sufficient bond
  await ensureAtlasBond(MINIMUM_BOND_AMOUNT);

  // Build and get the opportunity transaction with its gas parameters
  const { signedTx: opportunityRawTx, maxFeePerGas, maxPriorityFeePerGas } = await buildOpportunityTransaction();
  console.log("Dummy Opportunity Tx (raw):", opportunityRawTx);
  const oppTxHash = ethers.keccak256(opportunityRawTx);

  // Get the userOpHash from the DAppControl contract
  const userOpHash = await getUserOpHash(oppTxHash, maxFeePerGas, maxPriorityFeePerGas);

  // Build the solver operation
  const solverOp = await buildSolverOperation(
    userOpHash,
    DEFAULT_BID_AMOUNT,
    maxFeePerGas,
    maxPriorityFeePerGas
  );

  // Build and submit the bundle
  const bundle = buildBundle(solverOp, opportunityRawTx);
  await submitBundle(bundle, opportunityRawTx);
}

main()
  .then(() => console.log("Done."))
  .catch((err) => console.error(err));