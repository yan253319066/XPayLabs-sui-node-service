# XPay Labs (xpay) SUI Node Service — Express Proxy for SUI Blockchain

**XPay Labs (xpay) SUI Node Service** is a Node.js Express proxy that bridges the Spring Boot backend with the SUI blockchain. It handles balance queries, transaction scanning, and secure transaction signing via AES-encrypted private keys received from the Java backend.

Part of the [XPay Labs](https://www.xpaylabs.com) self-hosted crypto payment gateway.

## Security Architecture

1. **Private keys never persist** in the Node.js service — they are always stored in the Spring Boot backend
2. **AES-encrypted transmission** — Spring Boot encrypts private keys before sending to the Node service
3. **Ephemeral usage** — The Node service decrypts, signs, and immediately discards the key
4. **Proactive cleanup** — Signer data is wiped from memory after each signing operation
5. **Multi-environment** — Supports development, test, and production configurations

## Quick Start

```bash
npm install
npm run dev      # Development mode (:3001)
npm run prod     # Production mode
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/balance/{address}` | GET | Get SUI balance |
| `/transaction-blocks` | GET | Query transaction blocks (paginated) |
| `/transaction-block/{digest}` | GET | Get transaction block details |
| `/checkpoint/latest` | GET | Get latest checkpoint sequence number |
| `/checkpoint/{id}` | GET | Get specific checkpoint info |
| `/checkpoints` | GET | List checkpoints (paginated) |
| `/estimate-transfer-gas-fee` | POST | Estimate SUI transfer gas fee |
| `/estimate-token-transfer-gas-fee` | POST | Estimate token transfer gas fee |
| `/transfer-sui-with-key` | POST | Transfer SUI (encrypted key in body) |
| `/transfer-token-with-key` | POST | Transfer custom token (encrypted key in body) |

## Tech Stack

- **Runtime**: Node.js + Express
- **SDK**: @mysten/sui
- **Encryption**: AES-256-CBC (key shared with Spring Boot backend)

## Related Projects

- [Java Backend (SUI scanner module)](https://github.com/yan253319066/XPayLabs-java)
- [Docker Deployment](https://github.com/yan253319066/XPayLabs-docker)

## License

MIT
