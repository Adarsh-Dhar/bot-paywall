# x402 Workshop: Pay-Per-Request APIs on Movement

Build a paywall API that charges 1 MOVE to unlock premium content using the x402 protocol.

## Prerequisites

- Node.js 18+
- Movement-compatible wallet (Nightly recommended)
- MOVE tokens on mainnet

## Project Structure

```
x402_workshop/
├── workshop-code/     # Next.js frontend
├── server/            # Express backend with x402 paywall
└── WORKSHOP.md        # Workshop script/guide
```

## Installation

### 1. Install server dependencies

```bash
cd server
npm install
```

### 2. Configure server environment

```bash
cp .env.example .env
```

Edit `.env` and set your Movement wallet address:
```
MOVEMENT_PAY_TO=0x<your_address>
```

### 3. Install frontend dependencies

```bash
cd ../workshop-code
npm install --legacy-peer-deps
```

## Running

### Start the server (Terminal 1)

```bash
cd server
npm run dev
```

Server runs at http://localhost:4402

### Start the frontend (Terminal 2)

```bash
cd workshop-code
npm run dev
```

Frontend runs at http://localhost:3000

## Usage

1. Open http://localhost:3000
2. Connect your wallet (Movement mainnet)
3. Click "Unlock (1 MOVE)"
4. Approve the transaction in your wallet
5. Content unlocks after payment confirms

## How It Works

1. Client requests `/api/premium-content`
2. Server returns HTTP 402 with payment requirements
3. Client signs a transfer transaction (but doesn't submit)
4. Client retries with signed tx in `X-PAYMENT` header
5. Facilitator verifies signature and submits transaction
6. After on-chain confirmation, server releases content

## Workshop Guide

See [WORKSHOP.md](./WORKSHOP.md) for the full workshop script with explanations.
