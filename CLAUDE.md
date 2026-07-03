# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SUI blockchain Node.js RPC proxy service. Express + `@mysten/sui`, plain JavaScript (no TypeScript). Java backend sends AES-256-CBC encrypted private keys to this service for transaction signing.

## Commands

```bash
npm start              # Start server (node src/index.js)
npm run dev            # Development mode
npm run prod           # Production mode (NODE_ENV=production)
npm run test:encrypt   # Test encryption utility
```

No build step (plain JS), no linting, no test framework.

## API Endpoints

| Endpoint | Method | Description |
|------|------|------|
| `/health` | GET | Health check |
| `/balance/:address` | GET | Get SUI balance (optional `coinType`, `network` params) |
| `/transaction-blocks` | GET | Query transaction blocks (paginated) |
| `/transaction-block/:digest` | GET | Get single transaction details |
| `/checkpoint/latest` | GET | Latest checkpoint sequence number |
| `/checkpoints` | GET | List checkpoints (paginated) |
| `/estimate-transfer-gas-fee` | POST | Estimate SUI transfer gas fee |
| `/estimate-token-transfer-gas-fee` | POST | Estimate token transfer gas fee |
| `/transfer-sui-with-key` | POST | Transfer SUI (AES-encrypted private key) |
| `/transfer-token-with-key` | POST | Transfer custom token (AES-encrypted private key) |

## Security Architecture

1. Private keys stored in Java backend, never persisted in this service
2. Java encrypts private keys via AES-256-CBC before sending
3. This service decrypts → signs transaction → immediately clears sensitive data
4. `finally` blocks call `clearSignerSensitiveData()` to wipe memory

## Environment Variables

| Variable | Dev Default | Prod Default | Description |
|------|-----------|-----------|------|
| `PORT` | `3001` | `3001` | Server port |
| `ENCRYPTION_KEY` | `xpay123qwe...` | `xpaylabswe...` | AES-256-CBC 32-char key |
| `NODE_ENV` | `development` | `production` | Environment mode |
| `RATE_LIMIT_TOKENS` | `50` | `500` | Rate limit bucket size |
| `RATE_LIMIT_WINDOW_MS` | `10000` | `30000` | Rate limit window |

## Directory Structure

```
src/
├── index.js              # Express entry point
├── routes/
│   └── apiRoutes.js      # All 12 API endpoint definitions
├── services/
│   ├── signerService.js  # Signer creation, sensitive data clearing
│   └── suiService.js     # SUI chain ops (balance, transfer, query, gas estimation)
└── utils/
    ├── encryption.js     # AES-256-CBC encrypt/decrypt
    └── test.js           # Test utility
```
