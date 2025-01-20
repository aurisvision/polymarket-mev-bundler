# Polymarket MEV Bundle POC

Demonstrate a censorship-resistant transaction submission mechanism using Atlas and FastLane Labs infrastructure. This approach:
1. Publishes a user's transaction to the network
2. Creates a bundle for auction that includes this transaction
3. Achieves guaranteed inclusion through FastLane's direct validator connectivity
4. Retries failed submissions up to 3 times with 5-second intervals

## Project Structure

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
   - Retry mechanism for failed submissions (3 attempts, 5s delay)

4. `src/submitDummyBundle.ts`
   - Main orchestration script demonstrating the flow:
     1. Verify network and ensure solver has sufficient bond
     2. Build and sign the user's transaction
     3. Create a bundle including this transaction
     4. Submit to FastLane with retries
     5. Submit to RPC if not already on chain

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

## Requirements

1. Environment:
   - Network: Polygon (chainId=137)
   - Uses Atlas SDK for transaction handling
   - Requires RPC endpoint loaded from .env
   - Private keys loaded from .env file

2. Wallet Requirements:
   - Solver wallet: 0.5 MATIC minimum for bonding + gas
   - Opportunity wallet: Sufficient MATIC for transaction + gas

## Contract Addresses

| Contract | Address | Description |
|----------|---------|-------------|
| Atlas | `0x4A394bD4Bc2f4309ac0b75c052b242ba3e0f32e0` | Main Atlas contract |
| PFL-dApp | `0x3e23e4282FcE0cF42DCd0E9bdf39056434E65C1F` | PFL dApp contract |
| dAppSigner | `0x96D501A4C52669283980dc5648EEC6437e2E6346` | dApp signer |

## References

- [Atlas SDK Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane/searcher-guides/atlas-sdks)
- [FastLane Labs Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane) 