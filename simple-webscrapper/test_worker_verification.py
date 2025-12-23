#!/usr/bin/env python3
"""
Test the worker's payment verification logic directly
"""

import requests
import json

def test_worker_verification():
    """Test the worker's payment verification by simulating the API calls it makes"""
    
    tx_hash = "0x79451b927408f2913553f40dd7d9746f36a3e23d6dfd97ac69e14db4e5ff81ab"
    movement_rpc_url = "https://testnet.movementnetwork.xyz/v1"
    payment_address = "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b"
    
    print(f"Testing worker verification logic for transaction: {tx_hash}")
    
    # Step 1: Get transaction details (same as worker does)
    print("\n=== Step 1: Get transaction details ===")
    response = requests.get(f"{movement_rpc_url}/transactions/by_hash/{tx_hash}")
    
    if not response.ok:
        print(f"❌ HTTP Error: {response.status_code} {response.statusText}")
        return False
    
    tx_data = response.json()
    print(f"✅ Transaction retrieved successfully")
    
    # Step 2: Check if transaction was successful (worker check)
    print("\n=== Step 2: Check transaction success ===")
    if not tx_data.get('success'):
        print(f"❌ Transaction failed on blockchain")
        return False
    print(f"✅ Transaction successful")
    
    # Step 3: Check transaction type (worker check)
    print("\n=== Step 3: Check transaction type ===")
    if tx_data.get('type') != "user_transaction":
        print(f"❌ Invalid transaction type: {tx_data.get('type')}")
        return False
    print(f"✅ Transaction type valid: {tx_data.get('type')}")
    
    # Step 4: Check payload (worker check)
    print("\n=== Step 4: Check transaction payload ===")
    payload = tx_data.get('payload')
    if not payload or payload.get('type') != "entry_function_payload":
        print(f"❌ Invalid transaction payload: {payload}")
        return False
    print(f"✅ Payload type valid: {payload.get('type')}")
    
    # Step 5: Check function (worker check)
    print("\n=== Step 5: Check function ===")
    function = payload.get('function')
    allowed_functions = [
        "0x1::coin::transfer",
        "0x1::aptos_coin::transfer", 
        "0x1::aptos_account::transfer"
    ]
    
    if function not in allowed_functions:
        print(f"❌ Invalid function: {function}")
        print(f"Allowed functions: {allowed_functions}")
        return False
    print(f"✅ Function valid: {function}")
    
    # Step 6: Check transfer amount (worker check)
    print("\n=== Step 6: Check transfer amount ===")
    transfer_amount = payload.get('arguments', [])[1] if len(payload.get('arguments', [])) > 1 else None
    if transfer_amount != "1000000":
        print(f"❌ Invalid transfer amount: {transfer_amount}, expected 1000000 octas")
        return False
    print(f"✅ Transfer amount valid: {transfer_amount}")
    
    # Step 7: Check recipient address (worker check)
    print("\n=== Step 7: Check recipient address ===")
    recipient = payload.get('arguments', [])[0] if len(payload.get('arguments', [])) > 0 else None
    if recipient != payment_address:
        print(f"❌ Invalid recipient: {recipient}, expected {payment_address}")
        return False
    print(f"✅ Recipient valid: {recipient}")
    
    print("\n🎉 All worker verification checks passed!")
    print("The issue is likely in the IP whitelisting process, not the payment verification.")
    
    return True

if __name__ == "__main__":
    test_worker_verification()