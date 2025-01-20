# Polymarket MEV Bundle POC

This project demonstrates how to submit a bundle to Atlas using the FastLane Labs SDK. It includes an example of creating a dummy transaction and bundling it with a solver operation.

## Prerequisites

- Node.js (v16 or later)
- npm
- An Infura API key for Polygon network access
- Private keys for testing (opportunity wallet and solver wallet)

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and fill in your values:
     - `INFURA_RPC_URL`: Your Infura Polygon RPC URL
     - `OPPORTUNITY_WALLET_PRIVATE_KEY`: Private key for the opportunity wallet
     - `SOLVER_WALLET_PRIVATE_KEY`: Private key for the solver wallet
     - `FASTLANE_RELAY_URL`: (Optional) FastLane Polygon RPC URL, defaults to "https://polygon-rpc.fastlane.xyz/"

## Usage

To run the example:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Project Structure

- `src/bundleExample.ts` - Main example demonstrating Atlas SDK integration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies and scripts
- `.env.example` - Template for environment variables
- `.env` - Your actual environment variables (not committed to git)

## Important Notes

- This is a proof-of-concept implementation
- Uses Polygon network (chainId=137)
- The example creates a dummy transaction and solver operation
- Make sure to replace placeholder values in `.env` with actual credentials before running
- Never commit your `.env` file or expose your private keys

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