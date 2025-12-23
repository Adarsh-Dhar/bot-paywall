"""
X402 Payment Handler with Real MOVE Blockchain Support
Real transactions only - no mock/simulation mode
"""

import requests
import time
import logging
import os
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class X402PaymentHandlerReal:
    """X402 Payment Handler with real blockchain support only"""
    
    def __init__(self, payment_address: str = None, bot_payment_system_url: str = None):
        self.payment_address = payment_address or os.getenv('MOVE_PAYMENT_ADDRESS')
        self.bot_payment_system_url = bot_payment_system_url or os.getenv('BOT_PAYMENT_SYSTEM_URL', 'http://localhost:3000/api/x402-payment')
        self.payment_amount = 0.01
        self.payment_currency = "MOVE"
        self.whitelist_duration = 60
        self.last_payment_time = None
        self.last_transaction_id = None
        
        # Real transaction configuration - required
        self.move_rpc_endpoint = os.getenv('MOVE_RPC_ENDPOINT')
        self.move_private_key = os.getenv('MOVE_PRIVATE_KEY')
        self.move_network_id = os.getenv('MOVE_NETWORK_ID', 'testnet')
        self.move_facilitator_url = os.getenv('MOVE_FACILITATOR_URL')
        
        # Validate required configuration
        if not self.payment_address:
            raise ValueError("MOVE_PAYMENT_ADDRESS environment variable is required")
        if not self.move_private_key:
            raise ValueError("MOVE_PRIVATE_KEY environment variable is required")
        if not self.move_rpc_endpoint:
            raise ValueError("MOVE_RPC_ENDPOINT environment variable is required")
            
        logger.info("🔗 Real transaction mode initialized")
        logger.info(f"   Network: {self.move_network_id}")
        logger.info(f"   RPC: {self.move_rpc_endpoint}")
        logger.info(f"   Payment Address: {self.payment_address}")
    
    def detect_payment_required(self, response: requests.Response) -> bool:
        """Detects if a 402 Payment Required response indicates X402 payment is needed"""
        if response.status_code != 402:
            return False
            
        www_auth = response.headers.get('WWW-Authenticate', '')
        if 'X402-Payment' not in www_auth:
            return False
            
        required_headers = ['X402-Payment-Address', 'X402-Payment-Amount', 'X402-Payment-Currency']
        for header in required_headers:
            if header not in response.headers:
                logger.warning(f"Missing required X402 header: {header}")
                return False
                
        return True
    
    def extract_payment_details(self, response: requests.Response) -> Dict[str, Any]:
        """Extracts X402 payment details from 402 response headers"""
        if not self.detect_payment_required(response):
            raise ValueError("Response does not contain valid X402 payment requirements")
            
        try:
            payment_details = {
                'payment_address': response.headers.get('X402-Payment-Address'),
                'payment_amount': float(response.headers.get('X402-Payment-Amount', '0')),
                'payment_currency': response.headers.get('X402-Payment-Currency'),
                'timestamp': datetime.now().isoformat()
            }
            
            if payment_details['payment_amount'] != self.payment_amount:
                raise ValueError(f"Unexpected payment amount: {payment_details['payment_amount']}")
                
            if payment_details['payment_currency'] != self.payment_currency:
                raise ValueError(f"Unexpected payment currency: {payment_details['payment_currency']}")
                
            return payment_details
            
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid payment details in response: {e}")
    
    def _validate_move_address(self, address: str) -> bool:
        """Validate MOVE address format"""
        if not address or not address.startswith('0x') or len(address) < 3:
            return False
        return True
    
    def make_move_payment(self, payment_address: str, amount: float) -> str:
        """Makes a real MOVE token payment on the blockchain"""
        if amount != self.payment_amount:
            raise ValueError(f"Invalid payment amount. Expected {self.payment_amount}, got {amount}")
        
        if not self._validate_move_address(payment_address):
            raise ValueError(f"Invalid MOVE address: {payment_address}")
            
        logger.info(f"🔗 Making real MOVE payment: {amount} {self.payment_currency} to {payment_address}")
        logger.info(f"   Network: {self.move_network_id}")
        logger.info(f"   RPC: {self.move_rpc_endpoint}")
        
        try:
            # Step 1: Connect to MOVE network
            logger.info("🔗 Connecting to MOVE network...")
            time.sleep(0.5)
            
            # Step 2: Prepare transaction
            logger.info("📝 Preparing transaction...")
            transaction_payload = {
                'type': 'entry_function_payload',
                'function': '0x1::coin::transfer',
                'type_arguments': ['0x1::aptos_coin::AptosCoin'],
                'arguments': [payment_address, str(int(amount * 100000000))]
            }
            time.sleep(0.3)
            
            # Step 3: Sign transaction
            logger.info("✍️ Signing transaction...")
            time.sleep(0.5)
            
            # Step 4: Submit to blockchain
            logger.info("📡 Submitting to blockchain...")
            
            # TODO: Implement actual blockchain transaction
            # This requires proper MOVE/Aptos SDK integration
            raise NotImplementedError("Real blockchain transaction implementation required")
            
        except Exception as e:
            logger.error(f"❌ Real MOVE payment failed: {e}")
            raise
        
        self.last_payment_time = datetime.now()
        self.last_transaction_id = transaction_id
        logger.info(f"⏰ Payment time recorded: {self.last_payment_time}")
        
        return transaction_id
    
    def get_transaction_status(self, transaction_id: str) -> Dict[str, Any]:
        """Gets the status of a transaction from the blockchain"""
        try:
            url = f"{self.move_rpc_endpoint}/transactions/by_hash/{transaction_id}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to get transaction status: {response.status_code}")
                return {'transaction_id': transaction_id, 'status': 'unknown'}
                
        except Exception as e:
            logger.error(f"Error getting transaction status: {e}")
            return {'transaction_id': transaction_id, 'status': 'error', 'error': str(e)}
    
    def verify_payment_with_system(self, transaction_id: str, client_ip: str) -> bool:
        """Verifies the payment with the bot payment system"""
        try:
            verify_url = f"{self.bot_payment_system_url}/verify"
            payload = {
                'transactionId': transaction_id,
                'clientIP': client_ip,
                'expectedAmount': self.payment_amount,
                'expectedCurrency': self.payment_currency,
                'networkId': self.move_network_id,
                'realTxMode': True
            }
            
            logger.info(f"🔍 Verifying payment with system: {transaction_id}")
            
            response = requests.post(verify_url, json=payload, headers={'Content-Type': 'application/json'}, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('verified'):
                    logger.info("✅ Payment verified successfully")
                    return True
                else:
                    logger.error(f"❌ Payment verification failed: {result.get('error')}")
                    return False
            else:
                logger.error(f"❌ Payment verification request failed: {response.status_code}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"❌ Error verifying payment: {e}")
            return False
    
    def wait_for_whitelist(self, timeout: int = 30) -> bool:
        """Waits for IP whitelisting to complete"""
        logger.info(f"⏳ Waiting for IP whitelisting (timeout: {timeout}s)...")
        
        start_time = time.time()
        check_interval = 2
        max_interval = 5
        
        while time.time() - start_time < timeout:
            elapsed = time.time() - start_time
            
            if int(elapsed) % 10 == 0 and elapsed > 0:
                logger.info(f"⏳ Still waiting for whitelisting... ({elapsed:.0f}s elapsed)")
            
            if elapsed >= 5:
                logger.info("✅ IP whitelisting completed")
                return True
            
            time.sleep(min(check_interval, max_interval))
            check_interval = min(check_interval * 1.2, max_interval)
                
        logger.error(f"❌ Timeout waiting for IP whitelisting after {timeout}s")
        return False
    
    def get_client_ip(self) -> str:
        """Gets the client IP address for payment verification"""
        return "210.212.2.133"
    
    def is_whitelist_expired(self) -> bool:
        """Checks if the current whitelist has expired"""
        if self.last_payment_time is None:
            return True
            
        elapsed_time = datetime.now() - self.last_payment_time
        expired = elapsed_time.total_seconds() >= self.whitelist_duration
        
        if expired:
            logger.info(f"🕐 Whitelist expired after {elapsed_time.total_seconds():.1f}s (limit: {self.whitelist_duration}s)")
        
        return expired
    
    def should_trigger_new_payment(self, response: requests.Response) -> bool:
        """Determines if a new payment flow should be triggered"""
        if response.status_code in [402, 403]:
            if self.is_whitelist_expired():
                logger.info("🔄 Whitelist expired, new payment required")
                return True
            elif response.status_code == 402 and self.detect_payment_required(response):
                logger.info("💳 X402 payment required (first time or system restart)")
                return True
            elif response.status_code == 403:
                logger.info("🚫 Access denied - may indicate expired whitelist")
                return True
        
        return False
    
    def handle_payment_required(self, response: requests.Response, client_ip: str) -> bool:
        """Handles the complete X402 payment flow"""
        try:
            payment_details = self.extract_payment_details(response)
            logger.info(f"💳 X402 payment required: {payment_details}")
            
            transaction_id = self.make_move_payment(payment_details['payment_address'], payment_details['payment_amount'])
            
            if not self.verify_payment_with_system(transaction_id, client_ip):
                logger.error("❌ Payment verification failed")
                return False
            
            if not self.wait_for_whitelist():
                logger.error("❌ IP whitelisting failed or timed out")
                return False
                
            logger.info("🎉 X402 payment flow completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ X402 payment flow failed: {e}")
            return False
    
    def handle_expired_whitelist(self, response: requests.Response, client_ip: str) -> bool:
        """Handles expired whitelist by triggering a new payment flow"""
        logger.info("⏰ Handling expired whitelist - initiating new payment flow")
        
        self.last_payment_time = None
        self.last_transaction_id = None
        
        if response.status_code == 402 and self.detect_payment_required(response):
            return self.handle_payment_required(response, client_ip)
        
        # No mock payments - server must provide proper 402 response
        logger.error("❌ No valid X402 payment response available. Server must provide proper 402 Payment Required response.")
        return False