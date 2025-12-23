#!/usr/bin/env python3
"""
Test script to check available Aptos SDK methods
"""

import asyncio
from aptos_sdk.async_client import RestClient
from aptos_sdk.account import Account
import os
from dotenv import load_dotenv

load_dotenv()

async def test_methods():
    client = RestClient(os.getenv('MOVE_RPC_ENDPOINT'))
    account = Account.load_key(os.getenv('MOVE_PRIVATE_KEY'))
    
    print("RestClient methods:")
    methods = [method for method in dir(client) if not method.startswith('_')]
    for method in sorted(methods):
        print(f"  {method}")
    
    print("\nAccount methods:")
    methods = [method for method in dir(account) if not method.startswith('_')]
    for method in sorted(methods):
        print(f"  {method}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_methods())