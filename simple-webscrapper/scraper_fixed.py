#!/usr/bin/env python3
"""
Simple webscraper that scrapes https://test-cloudflare-website.adarsh.software/
with real MOVE blockchain payment support for accessing paywalled content.
Fixed version with cache-busting to avoid cached 402 responses.
"""

import requests
import logging
import json
import time
import os
from datetime import datetime
from dotenv import load_dotenv
from real_payment_handler import RealPaymentHandler

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def scrape_website():
    """Scrape the target website with real payment support."""
    base_url = "https://test-cloudflare-website.adarsh.software/"
    
    # Add cache-busting parameter to avoid cached 402 responses
    cache_bust = int(time.time())
    url = f"{base_url}?t={cache_bust}"
    
    # Initialize real payment handler
    payment_handler = RealPaymentHandler()
    
    # Use a session to maintain cookies/state with browser-like headers
    session = requests.Session()
    
    # Set browser-like headers to avoid bot detection
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    })
    
    try:
        logger.info(f"Starting to scrape: {url}")
        
        # Show current configuration
        logger.info("🔗 Real transaction mode enabled")
        balance = payment_handler.get_account_balance()
        logger.info(f"💰 Current balance: {balance / 100_000_000:.8f} MOVE")
        
        # Make the initial request
        response = session.get(url, timeout=30)
        
        # Check if payment is required
        if response.status_code == 402:
            logger.info("💳 Payment required (402 status code)")
            
            try:
                # Parse the payment requirements from the response body
                payment_data = response.json()
                logger.info(f"Payment data received: {payment_data}")
                
                # Handle legacy format (from cloudflare website)
                if payment_data.get('error') == 'Payment Required':
                    payment_address = payment_data.get('payment_address')
                    payment_amount = payment_data.get('price_move', 0.01)
                    
                    logger.info(f"💰 Payment required: {payment_amount} MOVE to {payment_address}")
                    
                    # Make the MOVE payment to the specified address
                    transaction_id = payment_handler.make_move_payment(payment_address, payment_amount)
                    
                    if transaction_id:
                        logger.info(f"✅ Payment completed! Transaction: {transaction_id}")
                        
                        # Verify the transaction
                        verification = payment_handler.verify_transaction(transaction_id)
                        logger.info(f"🔍 Transaction verification: {verification}")
                        
                        if verification.get('verified'):
                            logger.info("⏳ Submitting payment proof to Cloudflare worker...")
                            
                            # Submit payment proof using X402-Transaction-ID header
                            session.headers.update({
                                'X402-Transaction-ID': transaction_id
                            })
                            
                            # Try to access the content with payment proof (with new cache-bust)
                            retry_cache_bust = int(time.time())
                            retry_url = f"{base_url}?t={retry_cache_bust}"
                            logger.info("🔄 Attempting to access content with payment proof...")
                            retry_response = session.get(retry_url, timeout=30)
                            
                            if retry_response.status_code == 200:
                                logger.info("🎉 Payment successful! Access granted.")
                                response = retry_response
                            elif retry_response.status_code == 302:
                                logger.info("🎉 Payment successful! Redirected to content.")
                                response = retry_response
                            else:
                                logger.error(f"❌ Payment verification failed. Status: {retry_response.status_code}")
                                try:
                                    error_data = retry_response.json()
                                    logger.error(f"Error details: {error_data}")
                                except:
                                    logger.error(f"Response text: {retry_response.text[:500]}")
                                return None
                        else:
                            logger.error("❌ Transaction verification failed")
                            return None
                    else:
                        logger.error("❌ Payment failed")
                        return None
                        
                else:
                    logger.error("❌ Unexpected payment response format")
                    logger.error(f"Response data: {payment_data}")
                    return None
                    
            except json.JSONDecodeError:
                logger.error("❌ Failed to parse payment response as JSON")
                return None
        
        # Check for other errors
        elif response.status_code == 403:
            logger.error("🚫 Access forbidden - IP not whitelisted and no valid payment provided")
            try:
                error_data = response.json()
                logger.error(f"Server message: {error_data.get('message', 'No message provided')}")
            except:
                logger.error("Could not parse error response")
            return None
        
        # Raise for other HTTP errors
        response.raise_for_status()
        
        # Log the successful content
        logger.info(f"Successfully scraped website. Status code: {response.status_code}")
        logger.info(f"Content length: {len(response.text)} characters")
        logger.info("Website content:")
        logger.info("-" * 50)
        logger.info(response.text[:1000])  # Show first 1000 characters
        logger.info("-" * 50)
        
        return response.text
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping website: {e}")
        return None

if __name__ == "__main__":
    logger.info("Simple webscraper started")
    content = scrape_website()
    if content:
        logger.info("Scraping completed successfully")
    else:
        logger.error("Scraping failed")