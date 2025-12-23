# Real MOVE Transaction Setup Guide

## Quick Start

1. **Install Aptos SDK:**
   ```bash
   pip install aptos-sdk
   ```

2. **Run the setup script:**
   ```bash
   cd simple-webscrapper
   python setup_real_tx.py
   ```

3. **Create a Movement wallet:**
   ```bash
   # Install Aptos CLI
   curl -fsSL https://aptos.dev/scripts/install_cli.py | python3
   
   # Create wallet
   aptos init --network testnet
   
   # Fund with testnet tokens
   aptos account fund-with-faucet --account <your-address>
   ```

4. **Configure your environment:**
   ```bash
   # Get your private key
   aptos config show-private-key --profile default
   
   # Update .env file with your actual values
   MOVE_PRIVATE_KEY=your_64_character_private_key_here
   MOVE_RPC_ENDPOINT=https://aptos.testnet.porto.movementlabs.xyz/v1
   ```

5. **Test the setup:**
   ```bash
   python real_payment_handler.py
   ```

6. **Run the scraper:**
   ```bash
   python scraper.py
   ```

## What Happens with Real Transactions

The system now only supports real blockchain transactions:

1. ✅ **Real Blockchain Connection**: Connects to Movement testnet/mainnet
2. ✅ **Real Wallet**: Uses your actual wallet and private key
3. ✅ **Real Transactions**: Broadcasts actual transactions to the blockchain
4. ✅ **Real Confirmations**: Waits for blockchain confirmation
5. ✅ **Real Costs**: Uses actual MOVE tokens (testnet tokens are free)

## Required Environment Variables

All of these must be configured in your `.env` file:

```bash
# Blockchain Configuration (REQUIRED)
MOVE_RPC_ENDPOINT=https://aptos.testnet.porto.movementlabs.xyz/v1
MOVE_PRIVATE_KEY=your_64_character_private_key_here
MOVE_NETWORK_ID=testnet

# Payment Configuration  
PAYMENT_ADDRESS=0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b
BOT_PAYMENT_SYSTEM_URL=http://localhost:4402

# Client IP (the IP that will be whitelisted)
CLIENT_IP=210.212.2.133
```

## Troubleshooting

### "Aptos SDK import error"
```bash
pip install aptos-sdk
```

### "Environment variable required" errors
Make sure all required environment variables are set in your `.env` file:
- `MOVE_RPC_ENDPOINT`
- `MOVE_PRIVATE_KEY`

### "Insufficient balance" error
```bash
# Check your balance
python -c "from real_payment_handler import RealPaymentHandler; h=RealPaymentHandler(); print(f'Balance: {h.get_account_balance()/100_000_000:.8f} MOVE')"

# Fund your account
aptos account fund-with-faucet --account <your-address>
```

### "Transaction failed" error
- Check network connectivity
- Verify your private key is correct
- Ensure you have enough tokens for gas fees
- Try again (blockchain can be temporarily congested)

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use testnet first** before mainnet
3. **Keep private keys secure** - consider using environment variables
4. **Monitor your balance** to avoid unexpected costs
5. **Test thoroughly** before production use

## Network Configuration

### Testnet (Recommended for testing)
```bash
MOVE_NETWORK_ID=testnet
MOVE_RPC_ENDPOINT=https://aptos.testnet.porto.movementlabs.xyz/v1
```

### Mainnet (Production only)
```bash
MOVE_NETWORK_ID=mainnet
MOVE_RPC_ENDPOINT=https://aptos.mainnet.porto.movementlabs.xyz/v1
```

## Cost Estimation

- **Testnet**: Free (faucet tokens)
- **Mainnet**: ~0.01 MOVE per payment + gas fees (~0.001 MOVE)
- **Gas fees**: Automatically calculated and deducted

## Support

If you encounter issues:
1. Check the logs for detailed error messages
2. Verify all required environment variables are set
3. Verify your wallet has sufficient balance
4. Ensure network connectivity
5. Check Movement Labs documentation for network status

## Important Notes

- **Real Transactions Only**: The system no longer supports mock/simulation mode
- **Required Configuration**: All environment variables must be properly set
- **Network Fees**: Real transactions incur gas costs
- **Confirmation Time**: Real transactions take time to confirm on the blockchain
- **No Fallbacks**: If blockchain connection fails, the system will fail with clear error messages