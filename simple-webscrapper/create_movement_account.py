#!/usr/bin/env python3
"""
Create a new Movement mainnet account and get testnet tokens
"""

import asyncio
import logging
from aptos_sdk.account import Account
from aptos_sdk.async_client import RestClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_movement_account():
    """Create a new Movement account"""
    
    # Create a new account
    account = Account.generate()
    
    print("=" * 60)
    print("🆕 NEW MOVEMENT ACCOUNT CREATED")
    print("=" * 60)
    print(f"Address: {account.address()}")
    print(f"Private Key: 0x{account.private_key.hex()}")
    print(f"Public Key: 0x{account.public_key()}")
    print("=" * 60)
    
    # Test connection to mainnet
    mainnet_client = RestClient("https://rpc.ankr.com/http/movement_mainnet/v1")
    
    try:
        print("\n🔍 Checking account on Movement Mainnet...")
        try:
            account_info = await mainnet_client.account(account.address())
            print(f"✅ Account exists on mainnet: {account_info}")
        except Exception as e:
            if "account_not_found" in str(e):
                print("❌ Account not found on mainnet (expected for new accounts)")
                print("💡 You need to fund this account to activate it")
            else:
                print(f"❌ Error checking mainnet: {e}")
        
        # Check testnet
        print("\n🔍 Checking testnet...")
        testnet_client = RestClient("https://testnet.movementnetwork.xyz/v1")
        
        try:
            account_info = await testnet_client.account(account.address())
            print(f"✅ Account exists on testnet: {account_info}")
        except Exception as e:
            if "account_not_found" in str(e):
                print("❌ Account not found on testnet")
                print("💡 You can fund this account using the testnet faucet")
            else:
                print(f"❌ Error checking testnet: {e}")
        
        await testnet_client.close()
        
    except Exception as e:
        print(f"❌ Connection error: {e}")
    finally:
        await mainnet_client.close()
    
    print("\n" + "=" * 60)
    print("📝 NEXT STEPS:")
    print("=" * 60)
    print("1. Save your private key securely!")
    print("2. Update your .env file with the new private key")
    print("3. For testnet: Use the faucet at https://faucet.movementnetwork.xyz/")
    print("4. For mainnet: Transfer MOVE tokens to this address")
    print("5. Test the setup with: python real_payment_handler.py")
    print("=" * 60)
    
    return account

if __name__ == "__main__":
    asyncio.run(create_movement_account())