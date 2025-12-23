#!/usr/bin/env python3
"""
Debug script to check transaction details directly
"""

import requests
import json

def debug_transaction():
    """Check transaction details directly from Movement blockchain"""
    tx_hash = "0x79451b927408f2913553f40dd7d9746f36a3e23d6dfd97ac69e14db4e5ff81ab"
    rpc_url = "https://testnet.movementnetwork.xyz/v1"
    
    print(f"Checking transaction: {tx_hash}")
    
    response = requests.get(f"{rpc_url}/transactions/by_hash/{tx_hash}")
    
    if response.ok:
        tx_data = response.json()
        print("Transaction data:")
        print(json.dumps(tx_data, indent=2))
        
        # Check specific fields that the worker is looking for
        print("\n=== Worker Verification Checks ===")
        print(f"success: {tx_data.get('success')}")
        print(f"type: {tx_data.get('type')}")
        
        payload = tx_data.get('payload', {})
        print(f"payload.type: {payload.get('type')}")
        print(f"payload.function: {payload.get('function')}")
        print(f"payload.arguments: {payload.get('arguments')}")
        
        if payload.get('arguments'):
            print(f"recipient (arg[0]): {payload['arguments'][0]}")
            print(f"amount (arg[1]): {payload['arguments'][1]}")
    else:
        print(f"Error: {response.status_code} - {response.text}")

if __name__ == "__main__":
    debug_transaction()