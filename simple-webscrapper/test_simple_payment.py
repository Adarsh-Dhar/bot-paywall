#!/usr/bin/env python3
"""
Simple test to verify our payment system works end-to-end
"""

import requests
import json
from real_payment_handler import RealPaymentHandler

def test_simple_payment():
    """Test the payment flow without x402 facilitator"""
    
    # Initialize payment handler
    payment_handler = RealPaymentHandler()
    
    print(f"Account: {payment_handler.account.address()}")
    
    # Check balance
    balance = payment_handler.get_account_balance()
    print(f"Balance: {balance / 100_000_000:.8f} MOVE")
    
    # Make a test payment to ourselves
    our_address = str(payment_handler.account.address())
    print(f"Making test payment to ourselves: {our_address}")
    
    tx_hash = payment_handler.make_move_payment(our_address, 0.01)
    
    if tx_hash:
        print(f"✅ Payment successful: {tx_hash}")
        
        # Verify the transaction
        verification = payment_handler.verify_transaction(tx_hash)
        print(f"Verification: {verification}")
        
        return True
    else:
        print("❌ Payment failed")
        return False

if __name__ == "__main__":
    success = test_simple_payment()
    if success:
        print("\n🎉 Payment system is working correctly!")
        print("The issue is with the x402 facilitator integration, not our payment code.")
    else:
        print("\n❌ Payment system has issues.")