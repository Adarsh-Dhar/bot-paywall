#!/usr/bin/env python3
"""
Test script to debug payment verification logic matching the Cloudflare worker.
"""

import requests
import json

def test_payment_verification():
    """Test payment verification using the same logic as the Cloudflare worker."""
    
    transaction_id = "0xef577c2838f88b063af1607236d60991d2340d61dac600475ef21d31733b931b"
    movement_rpc_url = "https://testnet.movementnetwork.xyz/v1"
    payment_address = "0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b"
    
    print(f"Testing payment verification for transaction: {transaction_id}")
    print(f"Expected payment address: {payment_address}")
    print(f"Expected amount: 1000000 octas (0.01 MOVE)")
    print("-" * 60)
    
    try:
        # Get transaction details from Movement blockchain
        response = requests.get(f"{movement_rpc_url}/transactions/by_hash/{transaction_id}")
        
        print(f"HTTP Status: {response.status_code}")
        
        if not response.ok:
            print(f"❌ Transaction not found: {response.status_code} {response.reason}")
            return False

        tx_data = response.json()
        
        print(f"✅ Transaction retrieved successfully")
        print(f"Success: {tx_data.get('success')}")
        print(f"Type: {tx_data.get('type')}")
        
        # Check if transaction was successful
        if not tx_data.get('success'):
            print("❌ Transaction failed on blockchain")
            return False

        # Check if it's a user transaction
        if tx_data.get('type') != "user_transaction":
            print(f"❌ Invalid transaction type: {tx_data.get('type')}")
            return False

        # Check transaction payload
        payload = tx_data.get('payload')
        if not payload or payload.get('type') != "entry_function_payload":
            print(f"❌ Invalid transaction payload type: {payload.get('type') if payload else 'None'}")
            return False

        print(f"Function: {payload.get('function')}")
        print(f"Arguments: {payload.get('arguments')}")

        # Check if it's a coin transfer function
        function = payload.get('function')
        valid_functions = [
            "0x1::coin::transfer",
            "0x1::aptos_coin::transfer", 
            "0x1::aptos_account::transfer"
        ]
        
        if function not in valid_functions:
            print(f"❌ Invalid function: {function}")
            print(f"Expected one of: {valid_functions}")
            return False

        # Check transfer amount (should be 1000000 octas = 0.01 MOVE)
        arguments = payload.get('arguments', [])
        if len(arguments) < 2:
            print(f"❌ Insufficient arguments: {arguments}")
            return False
            
        recipient = arguments[0]
        transfer_amount = arguments[1]
        
        print(f"Recipient: {recipient}")
        print(f"Amount: {transfer_amount}")
        
        if transfer_amount != "1000000":
            print(f"❌ Invalid transfer amount: {transfer_amount}, expected 1000000 octas")
            return False

        # Check recipient address
        if recipient != payment_address:
            print(f"❌ Invalid recipient: {recipient}")
            print(f"Expected: {payment_address}")
            return False

        print("✅ Payment verification successful!")
        print(f"✅ Valid {function} of {transfer_amount} octas to {recipient}")
        
        return True
        
    except Exception as error:
        print(f"❌ Network error during payment verification: {error}")
        return False

if __name__ == "__main__":
    success = test_payment_verification()
    if success:
        print("\n🎉 Payment verification passed - transaction is valid!")
    else:
        print("\n❌ Payment verification failed - transaction is invalid!")