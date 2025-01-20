# Polymarket MEV Bundle POC

This project demonstrates a censorship-resistant transaction submission mechanism using Atlas and FastLane Labs infrastructure.

## Architecture

The system works by:
1. Publishing a user's transaction to the network normally
2. Creating a bundle that includes this transaction for auction
3. Achieving guaranteed inclusion through FastLane's direct validator connectivity

### Project Structure

1. `src/helpers.ts`
   - Common utilities and setup
   - Environment variables and constants
   - Network verification
   - Atlas bonding functionality

2. `src/opportunityTx.ts`
   - Core transaction customization point for users
   - Defines the transaction that needs censorship resistance
   - Currently implements a simple transfer, but can be modified for:
     * Complex DeFi interactions
     * Token transfers
     * Contract deployments
     * Any other transaction type

3. `src/pflBundle.ts`
   - PFL (Priority Fee Lane) bundle creation and submission
   - Solver operation building for auction participation
   - DAppControl contract interaction for userOp hashing
   - FastLane relay communication for validator connectivity

4. `src/submitDummyBundle.ts`
   - Main orchestration script demonstrating the flow:
     1. Verify network and ensure solver has sufficient bond
     2. Build and sign the user's transaction
     3. Create a bundle including this transaction
     4. Submit to FastLane for guaranteed inclusion

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with:
   ```
   RPC_URL=                         # Polygon RPC endpoint
   OPPORTUNITY_WALLET_PRIVATE_KEY=  # Key for the transaction sender
   SOLVER_WALLET_PRIVATE_KEY=       # Key for the bundle submitter
   ```

## Usage

1. Customize your transaction in `src/opportunityTx.ts`
2. Run the script:
   ```bash
   npm start
   ```

## Architecture Benefits

### 1. Censorship Resistance
- Transaction is published normally but also bundled
- FastLane ensures inclusion through direct validator connections
- Bypasses potential MEV-boost censorship

### 2. Customization
- Users can modify `opportunityTx.ts` for their specific needs
- Core bundle submission logic remains unchanged
- Maintains separation between user logic and infrastructure

## Requirements

- Network: Polygon (chainId=137)
- Uses Atlas SDK for transaction handling
- Requires RPC endpoint loaded from .env
- Private keys loaded from .env file

## Important Notes

1. The solver wallet needs:
   - Sufficient MATIC for bonding (minimum 0.5 MATIC)
   - Additional MATIC for gas fees

2. The opportunity wallet needs:
   - Sufficient MATIC for the transaction
   - Additional MATIC for gas fees

## Development

To modify for your own use:
1. Update `src/opportunityTx.ts` with your transaction logic
2. Keep the bundle submission flow in `src/pflBundle.ts` unchanged
3. Adjust gas parameters and bid amounts in `src/helpers.ts` if needed

## Contract Addresses

The project uses the following official FastLane contract addresses on Polygon:

| Contract | Address | Description |
|----------|---------|-------------|
| Atlas | `0x4A394bD4Bc2f4309ac0b75c052b242ba3e0f32e0` | Main contract handling bundle execution and MEV auction logic |
| AtlasVerification | `0xf31cf8740Dc4438Bb89a56Ee2234Ba9d5595c0E9` | Handles EIP-712 signature verification for solver operations |
| PFL-dApp | `0x3e23e4282FcE0cF42DCd0E9bdf39056434E65C1F` | Manages opportunity transaction processing and userOp generation |
| dAppSigner | `0x96D501A4C52669283980dc5648EEC6437e2E6346` | Authorized signer for the DAppControl contract |

## References

- [Atlas SDK Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane/searcher-guides/atlas-sdks)
- [FastLane Labs Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane) 