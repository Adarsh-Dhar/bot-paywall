# Movement Account Setup Guide

## Problem Identified

Your current account `0xdb466d22253732426f60d1a9ce33b080cf44160ed383277e399160ffdcc70b05` doesn't exist on Movement mainnet, which is why the balance shows 0 MOVE even though you have 30 MOVE tokens elsewhere.

**Error**: `Account not found by Address(...) and Ledger version(...)`

## Root Cause

Your 30 MOVE tokens are likely on:
- A centralized exchange (like Binance, Coinbase, etc.)
- A different blockchain network
- A wallet that hasn't been bridged to Movement mainnet

## Solutions

### Option 1: Create New Movement Account (Recommended)

1. **Generate a new account** (already done):
   ```
   Address: 0xea45b8b2c2ac1f768a3301fd5557c413c1177157b9278ef81e02f54e26bdbfed
   Private Key: 0x9416329775e81f634fd2c0d93682af7c6a28308938441d06dd52fdfd16b04f0e
   ```

2. **Update your .env file**:
   ```bash
   MOVE_PRIVATE_KEY=0x9416329775e81f634fd2c0d93682af7c6a28308938441d06dd52fdfd16b04f0e
   ```

3. **Fund the account**:
   - **For testing**: Use testnet faucet at https://faucet.movementnetwork.xyz/
   - **For production**: Transfer MOVE tokens from your current wallet/exchange

### Option 2: Bridge Your Existing Tokens

If your 30 MOVE tokens are on a different network:

1. **Find where your tokens are**:
   - Check your wallet (MetaMask, etc.)
   - Check exchanges (Binance, Coinbase, etc.)
   - Check other blockchain networks

2. **Bridge to Movement**:
   - Use Movement's bridge at https://bridge.movementnetwork.xyz/
   - Follow the bridging instructions for your source network

### Option 3: Use Testnet for Development

For development and testing, use testnet tokens:

1. **Update .env for testnet**:
   ```bash
   MOVE_NETWORK_ID=testnet
   MOVE_RPC_ENDPOINT=https://testnet.movementnetwork.xyz/v1
   MOVE_PRIVATE_KEY=0x9416329775e81f634fd2c0d93682af7c6a28308938441d06dd52fdfd16b04f0e
   ```

2. **Get testnet tokens**:
   - Visit https://faucet.movementnetwork.xyz/
   - Enter your address: `0xea45b8b2c2ac1f768a3301fd5557c413c1177157b9278ef81e02f54e26bdbfed`
   - Request testnet MOVE tokens

## Quick Fix for Testing

Let's get you running with testnet first:

1. **Update your .env file**:
   ```bash
   # Blockchain Configuration
   MOVE_NETWORK_ID=testnet
   MOVE_RPC_ENDPOINT=https://testnet.movementnetwork.xyz/v1
   MOVE_PRIVATE_KEY=0x9416329775e81f634fd2c0d93682af7c6a28308938441d06dd52fdfd16b04f0e

   # Payment Configuration  
   PAYMENT_ADDRESS=0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b
   BOT_PAYMENT_SYSTEM_URL=http://localhost:4402

   # Client IP (the IP that will be whitelisted)
   CLIENT_IP=210.212.2.133
   ```

2. **Get testnet tokens**:
   - Go to https://faucet.movementnetwork.xyz/
   - Enter: `0xea45b8b2c2ac1f768a3301fd5557c413c1177157b9278ef81e02f54e26bdbfed`
   - Request tokens

3. **Test the setup**:
   ```bash
   python real_payment_handler.py
   ```

## Verification Steps

After setting up, verify everything works:

```bash
# Check balance
python -c "from real_payment_handler import RealPaymentHandler; handler = RealPaymentHandler(); balance = handler.get_account_balance(); print(f'Balance: {balance / 100_000_000:.8f} MOVE')"

# Run the scraper
python scraper.py
```

## Important Security Notes

1. **Never share your private key**: `0x9416329775e81f634fd2c0d93682af7c6a28308938441d06dd52fdfd16b04f0e`
2. **Use testnet for development**: Don't spend real tokens while testing
3. **Keep backups**: Save your private key in a secure location
4. **Use environment variables**: Don't commit private keys to version control

## Troubleshooting

### "Account not found" error
- Account needs to be funded/activated first
- Use faucet for testnet or transfer tokens for mainnet

### "Insufficient balance" error
- Check you're on the right network (testnet vs mainnet)
- Verify tokens were received at the correct address
- Wait for transaction confirmation

### "Connection error"
- Try different RPC endpoints
- Check internet connection
- Verify RPC endpoint is working

## Next Steps

1. ✅ **Immediate**: Use testnet with faucet tokens for testing
2. 🔄 **Later**: Bridge your 30 MOVE tokens to Movement mainnet
3. 🚀 **Production**: Switch to mainnet with real tokens

This should resolve all the issues you were experiencing!