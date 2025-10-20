# Abako Ink - Polkadot API Ink Contracts

## Requirements

- Node.js >= 22.0.0



A Node.js API server for deploying and interacting with ink! smart contracts on Polkadot networks.

## Features

- Deploy ink! v5 and v6 contracts
- Query contract methods (read-only)
- Call contract methods (state-changing)
- Support for multiple ink! versions
- RESTful API interface

## Installation

```bash
npm install
```

## Running

```bash
npm start
# or
npm run server
# or
npx tsx src/server.ts
```

## Development

```bash
npm run dev
# or
npx tsx watch src/server.ts
```

## API Endpoints

- `GET /health` - Health check
- `GET /constructors` - Get available contract constructors
- `GET /query/:contractAddress/:methodName` - Query contract information (read-only)
- `POST /call/:contractAddress/:methodName` - Call a contract method (state-changing)
- `POST /deploy/v6` - Deploy a new contract with ink v6
- `POST /deploy/v5` - Deploy a new contract with ink v5

## Example Usage

```bash
# Deploy with ink v6
curl -X POST http://localhost:3010/deploy/v6 \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "dao_address": "0x1234..."}'

# Deploy with ink v5
curl -X POST http://localhost:3010/deploy/v5 \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "dao_address": "5E4S9C7PNW1cdYEY9p2U3bATksAQ69njeKS2JTBpTYPxKWds"}'
```
