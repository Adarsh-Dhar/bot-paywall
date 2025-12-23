#!/usr/bin/env python3
"""
Automated webscraper with IP whitelisting and X402 payment integration.
Automatically whitelists IP, makes payments when needed, and manages 60-second subscriptions.
"""

import requests
import logging
import json
import time
import os
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
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


class CloudflareIPManager:
    """Manages IP whitelisting through Cloudflare API"""
    
    def __init__(self):
        self.api_token = os.getenv('CLOUDFLARE_API_TOKEN')
        self.zone_id = os.getenv('CLOUDFLARE_ZONE_ID', '11685346bf13dc3ffebc9cc2866a8105')  # Default from your example
        self.base_url = "https://api.cloudflare.com/client/v4"
        
        if not self.api_token:
            # Try to get from main project
            main_env_path = os.path.join(os.path.dirname(__file__), '..', 'main', '.env')
            if os.path.exists(main_env_path):
                with open(main_env_path, 'r') as f:
                    for line in f:
                        if line.startswith('CLOUDFLARE_API_TOKEN='):
                            self.api_token = line.split('=', 1)[1].strip()
                            break
        
        if not self.api_token:
            raise ValueError("CLOUDFLARE_API_TOKEN not found in environment or main/.env")
        
        self.headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
        
        logger.info(f"Initialized Cloudflare IP Manager for zone: {self.zone_id}")
    
    def get_current_ip(self) -> str:
        """Get current public IP address"""
        try:
            response = requests.get('https://icanhazip.com', timeout=10)
            response.raise_for_status()
            ip = response.text.strip()
            logger.info(f"🌐 Current IP address: {ip}")
            return ip
        except Exception as e:
            logger.error(f"Failed to get current IP: {e}")
            # Fallback to environment variable if available
            fallback_ip = os.getenv('CLIENT_IP')
            if fallback_ip:
                logger.info(f"🔄 Using fallback IP from environment: {fallback_ip}")
                return fallback_ip
            raise
    
    def find_existing_rule(self, ip: str) -> Optional[str]:
        """Find existing whitelist rule for IP"""
        try:
            url = f"{self.base_url}/zones/{self.zone_id}/firewall/access_rules/rules"
            params = {'configuration.value': ip}
            
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success') and data.get('result'):
                rule_id = data['result'][0]['id']
                logger.info(f"📋 Found existing rule for {ip}: {rule_id}")
                return rule_id
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to find existing rule for {ip}: {e}")
            return None
    
    def create_whitelist_rule(self, ip: str) -> Optional[str]:
        """Create a whitelist rule for the IP"""
        try:
            # First check if rule already exists
            existing_rule = self.find_existing_rule(ip)
            if existing_rule:
                logger.info(f"✅ IP {ip} already whitelisted with rule: {existing_rule}")
                return existing_rule
            
            url = f"{self.base_url}/zones/{self.zone_id}/firewall/access_rules/rules"
            data = {
                "mode": "whitelist",
                "configuration": {
                    "target": "ip",
                    "value": ip
                },
                "notes": "Automated bot payment - 60s subscription"
            }
            
            response = requests.post(url, headers=self.headers, json=data, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            if result.get('success'):
                rule_id = result['result']['id']
                logger.info(f"✅ Created whitelist rule for {ip}: {rule_id}")
                return rule_id
            else:
                logger.error(f"Failed to create whitelist rule: {result}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to create whitelist rule for {ip}: {e}")
            return None
    
    def remove_whitelist_rule(self, rule_id: str) -> bool:
        """Remove a whitelist rule"""
        try:
            url = f"{self.base_url}/zones/{self.zone_id}/firewall/access_rules/rules/{rule_id}"
            
            response = requests.delete(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            if result.get('success'):
                logger.info(f"🗑️ Removed whitelist rule: {rule_id}")
                return True
            else:
                logger.error(f"Failed to remove whitelist rule: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to remove whitelist rule {rule_id}: {e}")
            return False
    
    def schedule_rule_removal(self, rule_id: str, delay_seconds: int = 60):
        """Schedule removal of whitelist rule after delay"""
        def remove_after_delay():
            logger.info(f"⏰ Scheduling rule removal in {delay_seconds} seconds: {rule_id}")
            time.sleep(delay_seconds)
            logger.info(f"🕐 Time expired, removing rule: {rule_id}")
            self.remove_whitelist_rule(rule_id)
        
        # Start removal in background thread
        removal_thread = threading.Thread(target=remove_after_delay, daemon=True)
        removal_thread.start()
        logger.info(f"📅 Scheduled rule {rule_id} for removal in {delay_seconds} seconds")


class AutomatedScraper:
    """Automated scraper with IP whitelisting and payment integration"""
    
    def __init__(self):
        self.payment_handler = RealPaymentHandler()
        self.ip_manager = CloudflareIPManager()
        self.current_ip = None
        self.current_rule_id = None
        
        # Session for maintaining state
        self.session = requests.Session()
        self.session.headers.update({
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
    
    def ensure_ip_whitelisted(self) -> bool:
        """Ensure current IP is whitelisted"""
        try:
            # Get current IP
            self.current_ip = self.ip_manager.get_current_ip()
            
            # Create or find whitelist rule
            rule_id = self.ip_manager.create_whitelist_rule(self.current_ip)
            if rule_id:
                self.current_rule_id = rule_id
                
                # Schedule removal after 60 seconds
                self.ip_manager.schedule_rule_removal(rule_id, 60)
                
                # Wait a moment for the rule to propagate
                logger.info("⏳ Waiting for whitelist rule to propagate...")
                time.sleep(3)
                
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to ensure IP whitelisted: {e}")
            return False
    
    def make_payment_if_required(self, url: str) -> bool:
        """Make payment if required by the server"""
        try:
            # Add cache-busting parameter
            cache_bust = int(time.time())
            test_url = f"{url}?t={cache_bust}"
            
            logger.info(f"🔍 Testing access to: {test_url}")
            response = self.session.get(test_url, timeout=30)
            
            if response.status_code == 200:
                logger.info("✅ Access granted - no payment required")
                return True
            
            elif response.status_code == 402:
                logger.info("💳 Payment required (402 status code)")
                
                try:
                    payment_data = response.json()
                    logger.info(f"Payment data received: {payment_data}")
                    
                    # Handle x402 protocol format
                    if 'accepts' in payment_data and len(payment_data['accepts']) > 0:
                        accept_info = payment_data['accepts'][0]
                        payment_address = accept_info.get('payTo')
                        max_amount_octas = int(accept_info.get('maxAmountRequired', '1000000'))
                        payment_amount = max_amount_octas / 100_000_000
                        
                        logger.info(f"💰 x402 Payment required: {payment_amount} MOVE to {payment_address}")
                        
                        # Make the payment
                        transaction_id = self.payment_handler.make_move_payment(payment_address, payment_amount)
                        
                        if transaction_id:
                            logger.info(f"✅ Payment completed! Transaction: {transaction_id}")
                            
                            # Verify the transaction
                            verification = self.payment_handler.verify_transaction(transaction_id)
                            logger.info(f"🔍 Transaction verification: {verification}")
                            
                            if verification.get('verified'):
                                # Add payment proof to session headers
                                self.session.headers.update({
                                    'X402-Transaction-ID': transaction_id
                                })
                                
                                logger.info("✅ Payment verified and added to session")
                                return True
                            else:
                                logger.error("❌ Transaction verification failed")
                                return False
                        else:
                            logger.error("❌ Payment failed")
                            return False
                    
                    # Handle legacy format
                    elif payment_data.get('error') == 'Payment Required':
                        payment_address = payment_data.get('payment_address')
                        payment_amount = payment_data.get('price_move', 0.01)
                        
                        logger.info(f"💰 Legacy payment required: {payment_amount} MOVE to {payment_address}")
                        
                        transaction_id = self.payment_handler.make_move_payment(payment_address, payment_amount)
                        
                        if transaction_id:
                            logger.info(f"✅ Payment completed! Transaction: {transaction_id}")
                            
                            verification = self.payment_handler.verify_transaction(transaction_id)
                            if verification.get('verified'):
                                self.session.headers.update({
                                    'X402-Transaction-ID': transaction_id
                                })
                                return True
                        
                        return False
                    
                    else:
                        logger.error("❌ Unexpected payment response format")
                        return False
                        
                except json.JSONDecodeError:
                    logger.error("❌ Failed to parse payment response as JSON")
                    return False
            
            elif response.status_code == 403:
                logger.error("🚫 Access forbidden - IP not whitelisted")
                return False
            
            else:
                logger.warning(f"⚠️ Unexpected status code: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to test/make payment: {e}")
            return False
    
    def scrape_website(self, url: str = "https://test-cloudflare-website.adarsh.software/") -> Optional[str]:
        """
        Main scraping method with automatic IP whitelisting and payment handling
        """
        logger.info("🤖 Starting automated scraper with IP whitelisting")
        
        # Show current balance
        balance = self.payment_handler.get_account_balance()
        logger.info(f"💰 Current balance: {balance / 100_000_000:.8f} MOVE")
        
        # Step 1: Ensure IP is whitelisted
        logger.info("📋 Step 1: Ensuring IP is whitelisted...")
        if not self.ensure_ip_whitelisted():
            logger.error("❌ Failed to whitelist IP")
            return None
        
        # Step 2: Test access and make payment if required
        logger.info("💳 Step 2: Testing access and handling payments...")
        if not self.make_payment_if_required(url):
            logger.error("❌ Failed to gain access (payment or other issue)")
            return None
        
        # Step 3: Scrape the content
        logger.info("🕷️ Step 3: Scraping content...")
        try:
            # Add cache-busting parameter
            cache_bust = int(time.time())
            final_url = f"{url}?t={cache_bust}"
            
            response = self.session.get(final_url, timeout=30)
            response.raise_for_status()
            
            logger.info(f"✅ Successfully scraped website. Status code: {response.status_code}")
            logger.info(f"📄 Content length: {len(response.text)} characters")
            
            # Log content preview
            logger.info("Website content:")
            logger.info("-" * 50)
            logger.info(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)
            logger.info("-" * 50)
            
            return response.text
            
        except Exception as e:
            logger.error(f"Failed to scrape website: {e}")
            return None
    
    def cleanup(self):
        """Manual cleanup of resources"""
        if self.current_rule_id:
            logger.info("🧹 Manual cleanup: removing whitelist rule")
            self.ip_manager.remove_whitelist_rule(self.current_rule_id)
            self.current_rule_id = None


def main():
    """Main function"""
    scraper = AutomatedScraper()
    
    try:
        content = scraper.scrape_website()
        if content:
            logger.info("🎉 Scraping completed successfully!")
            logger.info(f"📊 Total content length: {len(content)} characters")
        else:
            logger.error("❌ Scraping failed")
            return 1
            
    except KeyboardInterrupt:
        logger.info("⏹️ Scraping interrupted by user")
        scraper.cleanup()
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        scraper.cleanup()
        return 1
    
    logger.info("✅ Process completed. IP whitelist will auto-expire in 60 seconds.")
    return 0


if __name__ == "__main__":
    exit(main())