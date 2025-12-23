#!/usr/bin/env python3
"""
Debug script to test the payment flow step by step
"""

import requests
import json
import logging
from real_payment_handler import RealPaymentHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_payment_flow():
    """Debug the payment flow step by step"""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    # Initialize payment handler
    payment_handler = RealPaymentHandler()
    
    # Step 1: Make initial request to get 402 response
    logger.info("Step 1: Making initial request...")
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
    })
    
    response = session.get(url)
    logger.info(f"Initial response status: {response.status_code}")
    
    if response.status_code == 402:
        payment_data = response.json()
        logger.info(f"Payment data: {payment_data}")
        
        # Step 2: Make payment
        logger.info("Step 2: Making payment...")
        payment_address = payment_data.get('payment_address')
        payment_amount = payment_data.get('price_move', 0.01)
        
        tx_hash = payment_handler.make_move_payment(payment_address, payment_amount)
        logger.info(f"Transaction hash: {tx_hash}")
        
        if tx_hash:
            # Step 3: Verify transaction
            logger.info("Step 3: Verifying transaction...")
            verification = payment_handler.verify_transaction(tx_hash)
            logger.info(f"Verification result: {verification}")
            
            if verification.get('verified'):
                # Step 4: Test payment proof submission
                logger.info("Step 4: Testing payment proof submission...")
                
                # Add transaction ID header
                session.headers.update({
                    'X402-Transaction-ID': tx_hash
                })
                
                # Make request with payment proof
                retry_response = session.get(url)
                logger.info(f"Payment proof response status: {retry_response.status_code}")
                logger.info(f"Response headers: {dict(retry_response.headers)}")
                
                if retry_response.status_code != 200:
                    logger.error(f"Response text: {retry_response.text[:1000]}")
                else:
                    logger.info("✅ Payment successful!")
                    
                # Step 5: Test without payment header (should still work if IP is whitelisted)
                logger.info("Step 5: Testing without payment header (IP whitelisting check)...")
                session.headers.pop('X402-Transaction-ID', None)
                
                final_response = session.get(url)
                logger.info(f"Final response status (no payment header): {final_response.status_code}")
                
                if final_response.status_code == 200:
                    logger.info("✅ IP successfully whitelisted!")
                else:
                    logger.error("❌ IP not whitelisted properly")

if __name__ == "__main__":
    debug_payment_flow()