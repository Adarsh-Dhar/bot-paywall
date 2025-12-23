#!/usr/bin/env python3
"""
Test script to check bcs_transfer method signature
"""

import asyncio
from aptos_sdk.async_client import RestClient
from aptos_sdk.account import Account
from aptos_sdk.account_address import AccountAddress
import os
from dotenv import load_dotenv
import inspect

load_dotenv()

async def test_bcs_transfer():
    client = RestClient(os.getenv('MOVE_RPC_ENDPOINT'))
    account = Account.load_key(os.getenv('MOVE_PRIVATE_KEY'))
    
    print("bcs_transfer method signature:")
    sig = inspect.signature(client.bcs_transfer)
    print(f"  {sig}")
    
    print("\nbcs_transfer method docstring:")
    print(f"  {client.bcs_transfer.__doc__}")
    
    # Test with AccountAddress object
    try:
        recipient = AccountAddress.from_str("0xea45b8b2c2ac1f768a3301fd5557c413c1177157b9278ef81e02f54e26bdbfed")
        print(f"\nAccountAddress object: {recipient}")
        print(f"AccountAddress type: {type(recipient)}")
        print(f"AccountAddress methods: {[m for m in dir(recipient) if not m.startswith('_')]}")
    except Exception as e:
        print(f"Error creating AccountAddress: {e}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_bcs_transfer())