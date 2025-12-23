# Simple Webscraper with Real MOVE Payments

## Overview

This webscraper automatically handles paywalled content by making real MOVE blockchain payments when it encounters a 402 Payment Required response.

## Features

✅ **Real Blockchain Integration**: Uses Aptos SDK for Movement blockchain
✅ **Automatic Payment Detection**: Detects 402 responses and payment requirements
✅ **Real Transaction Support**: Makes actual MOVE token payments
✅ **Mock Mode**: Test without spending real tokens
✅ **Transaction Verification**: Confirms payments on-chain
✅ **Browser-Like Headers**: Reduces bot detection
✅ **Comprehensive Logging**: Detailed payment flow tracking

## Quick Start

### 1. Install Dependencies
```bash
cd simple-webscrapper
pip install -r requirements.txt
```

### 2. Setup (Choose One)

#### Option A: Mock Mode (No wallet needed)
```bash
cp .env.example .env
# Leave REAL_TX_MODE=false
python scraper.py
```

#### Option B: Real Mode (Requires wallet)
```bash
# Run setup wizard
python setup_real_tx.py

# Follow the instructions to:
# - Create a Movement wallet
# - Get testnet tokens
# - Configure your private key
```

### 3. Run the Scraper
```bash
python scraper.py
```

## Configuration

Edit `.env` file:

```bash
# Transaction Mode
REAL_TX_MODE=false          # Set to 'true' for real transactions

# Blockchain Settings
MOVE_NETWORK_ID=testnet     # or 'mainnet'
MOVE_RPC_ENDPOINT=https://aptos.testnet.porto.movementlabs.xyz/v1
MOVE_PRIVATE_KEY=your_key   # Required for real mode

# Payment Settings
PAYMENT_ADDRESS=0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b
CLIENT_IP=210.212.2.133
```

## How It Works

```
1. Scraper requests URL
   ↓
2. Receives 402 Payment Required
   ↓
3. Parses payment details (address, amount)
   ↓
4. Makes MOVE payment (real or mock)
   ↓
5. Waits for blockchain confirmation
   ↓
6. Retries request after payment
   ↓
7. Access granted (200 OK)
```

## Files

- `scraper.py` - Main scraper with payment integration
- `real_payment_handler.py` - Real blockchain payment handler
- `setup_real_tx.py` - Setup wizard for real transactions
- `.env` - Configuration (create from .env.example)
- `REAL_TX_SETUP.md` - Detailed setup guide
- `PAYMENT_INTEGRATION.md` - Technical documentation

## Testing

### Test Mock Mode
```bash
REAL_TX_MODE=false python scraper.py
```

### Test Real Mode
```bash
REAL_TX_MODE=true python scraper.py
```

### Test Payment Handler
```bash
python real_payment_handler.py
```

## Example Output

### Mock Mode
```
2025-12-22 15:00:00,000 - INFO - Starting to scrape: https://...
2025-12-22 15:00:00,100 - INFO - 🔧 Mock transaction mode enabled
2025-12-22 15:00:00,200 - INFO - 💳 Payment required (402 status code)
2025-12-22 15:00:00,300 - INFO - 💰 Payment required: 0.01 MOVE to 0xea859...
2025-12-22 15:00:00,400 - INFO - 🔧 Simulating payment (REAL_TX_MODE=false)
2025-12-22 15:00:02,000 - INFO - ✅ Payment simulation completed!
2025-12-22 15:00:02,100 - INFO - 📋 Simulated transaction ID: 0x704c53...
```

### Real Mode
```
2025-12-22 15:00:00,000 - INFO - Starting to scrape: https://...
2025-12-22 15:00:00,100 - INFO - 🔗 Real transaction mode enabled
2025-12-22 15:00:00,200 - INFO - 💰 Current balance: 10.50000000 MOVE
2025-12-22 15:00:00,300 - INFO - 💳 Payment required (402 status code)
2025-12-22 15:00:00,400 - INFO - 💰 Making payment: 0.01 MOVE to 0xea859...
2025-12-22 15:00:00,500 - INFO - 📡 Submitting transaction to blockchain...
2025-12-22 15:00:02,000 - INFO - 📋 Transaction submitted: 0x8f3a2b...
2025-12-22 15:00:05,000 - INFO - ✅ Transaction confirmed successfully!
```

## Wallet Setup

### Create Wallet
```bash
# Install Aptos CLI
curl -fsSL https://aptos.dev/scripts/install_cli.py | python3

# Initialize wallet
aptos init --network testnet

# Get your address
aptos account list
```

### Fund Wallet (Testnet)
```bash
# Get free testnet tokens
aptos account fund-with-faucet --account <your-address>

# Check balance
aptos account balance --account <your-address>
```

### Get Private Key
```bash
# Show private key (keep this secure!)
aptos config show-private-key --profile default
```

## Troubleshooting

### Issue: "Insufficient balance"
**Solution**: Fund your wallet with testnet tokens
```bash
aptos account fund-with-faucet --account <your-address>
```

### Issue: "Aptos SDK not available"
**Solution**: Install the SDK
```bash
pip install aptos-sdk
```

### Issue: "Transaction failed"
**Solutions**:
- Check network connectivity
- Verify private key is correct
- Ensure sufficient balance for gas fees
- Wait and retry (network may be congested)

### Issue: "Payment timeout"
**Solutions**:
- Increase retry attempts in scraper.py
- Check if payment was actually made on blockchain
- Verify the paywall system is processing payments

## Security

⚠️ **Important Security Notes:**

1. **Never commit `.env` file** to version control
2. **Keep private keys secure** - they control your funds
3. **Use testnet first** before mainnet
4. **Monitor your balance** to avoid unexpected costs
5. **Rotate keys regularly** in production

## Cost Estimation

### Testnet (Free)
- Tokens: Free from faucet
- Gas fees: Free
- Perfect for testing

### Mainnet (Production)
- Payment: 0.01 MOVE per request (~$0.01 USD)
- Gas fees: ~0.001 MOVE (~$0.001 USD)
- Total: ~0.011 MOVE per request

## Next Steps

1. ✅ Test in mock mode
2. ✅ Create a testnet wallet
3. ✅ Fund with testnet tokens
4. ✅ Test in real mode
5. ⏳ Deploy to production (mainnet)

## Support & Documentation

- **Setup Guide**: See `REAL_TX_SETUP.md`
- **Technical Docs**: See `PAYMENT_INTEGRATION.md`
- **Movement Labs**: https://docs.movementlabs.xyz
- **Aptos SDK**: https://aptos.dev/sdks/python-sdk

## License

MIT