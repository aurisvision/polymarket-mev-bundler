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
   - Update the `RPC_URL` in `src/bundleExample.ts` with your Infura API key
   - Set your test wallet private keys in `src/bundleExample.ts`

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

## Important Notes

- This is a proof-of-concept implementation
- Uses Polygon network (chainId=137)
- The example creates a dummy transaction and solver operation
- Make sure to replace placeholder values with actual credentials before running

## References

- [Atlas SDK Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane/searcher-guides/atlas-sdks)
- [FastLane Labs Documentation](https://fastlane-labs.gitbook.io/polygon-fastlane) 