# Claude Code Instructions

## Required Reading

Before working on this project, **always read and reference** the following documentation files located in the `/ai/` folder:

1. **[ai/FHE-REFERENCE.md](ai/FHE-REFERENCE.md)** - Quick reference guide for FHE development patterns, cofhejs integration, encryption/decryption flows, and common code snippets.

2. **[ai/FHE-DEVELOPMENT-GUIDE.md](ai/FHE-DEVELOPMENT-GUIDE.md)** - Comprehensive development guide with detailed explanations of FHE concepts and implementation details.
3. **[ai/sealedbid.md](ai/sealedbid.md)** - Comprehensive development guide of this unique prject idea.

## When to Reference These Files

- **Starting any new task** - Read the relevant sections first
- **Writing smart contracts** - Reference the contract patterns and FHE operations
- **Frontend FHE integration** - Reference cofhejs initialization, permits, and encryption flows
- **Debugging FHE issues** - Check the troubleshooting section
- **Adding new features** - Follow established patterns from the reference docs

## Project Overview

This is a Fhenix FHE (Fully Homomorphic Encryption) project using:
- **Smart Contracts**: Solidity 0.8.25 with `@fhenixprotocol/cofhe-contracts`
- **Frontend**: Next.js with `cofhejs` for client-side encryption
- **Monorepo**: pnpm workspaces with `packages/hardhat` and `packages/nextjs`

## Key Technologies

| Component | Technology |
|-----------|------------|
| FHE Contracts | `@fhenixprotocol/cofhe-contracts`, `fhenix-confidential-contracts` |
| FHE Client | `cofhejs` |
| Web3 | `wagmi`, `viem`, `@rainbow-me/rainbowkit` |
| State | `zustand` |
| Styling | `tailwindcss`, `daisyui` |

## Important Notes

- Always use FHE patterns from the reference docs - don't improvise
- Permits are required for all decryption operations
- Use `cofhejs.initializeWithViem()` for frontend FHE setup
- Solidity compiler must be 0.8.25 with EVM version "cancun"
