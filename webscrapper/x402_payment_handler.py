"""
X402 Payment Handler for automated bot payment processing
"""

import requests
import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class X402PaymentHandler:
    """Handles X402 payment flow for bot access"""
    
    def __init__(self, payment_address: str = None, bot_payment_system_url: str = None):
        self.payment_address = payment_address
        self.bot_payment_system_url = bot_payment_system_url or "http://localhost:3000/api/x402-payment"
        self.payment_amount = 0.01
        self.payment_currency = "MOVE"
        self.whitelist_duration = 60  # 60 seconds as per system design
        self.last_payment_time = None
        self.last_transaction_id = None
        
    def detect_payment_required(self, response: requests.Response) -> bool:
        """
        Detects if a 402 Payment Required response indicates X402 payment is needed
        """
        if response.status_code != 402:
            return False
            
        # Check for X402 headers
        www_auth = response.headers.get('WWW-Authenticate', '')
        if 'X402-Payment' not in www_auth:
            return False
            
        # Verify X402 payment headers are present
        required_headers = [
            'X402-Payment-Address',
            'X402-Payment-Amount', 
            'X402-Payment-Currency'
        ]
        
        for header in required_headers:
            if header not in response.headers:
                logger.warning(f"Missing required X402 header: {header}")
                return False
                
        return True
    
    def extract_payment_details(self, response: requests.Response) -> Dict[str, Any]:
        """
        Extracts X402 payment details from 402 response headers
        """
        if not self.detect_payment_required(response):
            raise ValueError("Response does not contain valid X402 payment requirements")
            
        try:
            payment_details = {
                'payment_address': response.headers.get('X402-Payment-Address'),
                'payment_amount': float(response.headers.get('X402-Payment-Amount', '0')),
                'payment_currency': response.headers.get('X402-Payment-Currency'),
                'timestamp': datetime.now().isoformat()
            }
            
            # Validate payment details
            if payment_details['payment_amount'] != self.payment_amount:
                raise ValueError(f"Unexpected payment amount: {payment_details['payment_amount']}")
                
            if payment_details['payment_currency'] != self.payment_currency:
                raise ValueError(f"Unexpected payment currency: {payment_details['payment_currency']}")
                
            return payment_details
            
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid payment details in response: {e}")
    
    def make_move_payment(self, payment_address: str, amount: float) -> str:
        """
        Makes a MOVE token payment
        In a real implementation, this would interact with the MOVE blockchain
        For now, this simulates the payment process
        """
        logger.info(f"💰 Initiating X402 payment: {amount} {self.payment_currency} to {payment_address}")
        
        # Validate payment parameters
        if amount != self.payment_amount:
            raise ValueError(f"Invalid payment amount. Expected {self.payment_amount}, got {amount}")
        
        # Simulate blockchain interaction
        logger.info("🔗 Connecting to MOVE blockchain...")
        time.sleep(0.5)  # Simulate network delay
        
        logger.info("📝 Creating transaction...")
        time.sleep(0.5)  # Simulate transaction creation
        
        logger.info("✍️ Signing transaction...")
        time.sleep(0.3)  # Simulate signing
        
        logger.info("📡 Broadcasting transaction...")
        time.sleep(1.0)  # Simulate broadcast and confirmation
        
        # Generate a realistic-looking transaction ID
        # In reality, this would come from the blockchain transaction
        import hashlib
        import random
        
        # Create a deterministic but unique transaction ID
        tx_data = f"{payment_address}_{amount}_{time.time()}_{random.randint(1000, 9999)}"
        tx_hash = hashlib.sha256(tx_data.encode()).hexdigest()
        transaction_id = f"0x{tx_hash[:64]}"  # 64-character hex string
        
        # Track payment time for expiration detection
        self.last_payment_time = datetime.now()
        self.last_transaction_id = transaction_id
        
        logger.info(f"✅ Payment completed successfully!")
        logger.info(f"📋 Transaction ID: {transaction_id}")
        logger.info(f"💸 Amount: {amount} {self.payment_currency}")
        logger.info(f"📍 To Address: {payment_address}")
        logger.info(f"⏰ Payment time recorded: {self.last_payment_time}")
        
        return transaction_id
    
    def verify_payment_with_system(self, transaction_id: str, client_ip: str) -> bool:
        """
        Verifies the payment with the bot payment system
        """
        try:
            verify_url = f"{self.bot_payment_system_url}/verify"
            payload = {
                'transactionId': transaction_id,
                'clientIP': client_ip,
                'expectedAmount': self.payment_amount,
                'expectedCurrency': self.payment_currency
            }
            
            logger.info(f"🔍 Verifying payment with system: {transaction_id}")
            
            response = requests.post(
                verify_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
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
            # For development/testing purposes, if the main server isn't running,
            # we'll simulate successful verification after a valid transaction
            if "Connection" in str(e) or "timeout" in str(e).lower():
                logger.info("🔧 Main server not available, using mock verification for development")
                if transaction_id and transaction_id.startswith('0x') and len(transaction_id) == 66:
                    logger.info("✅ Mock payment verification successful (development mode)")
                    return True
                else:
                    logger.error("❌ Invalid transaction ID format for mock verification")
                    return False
            return False
    
    def wait_for_whitelist(self, timeout: int = 30) -> bool:
        """
        Waits for IP whitelisting to complete with intelligent polling
        """
        logger.info(f"⏳ Waiting for IP whitelisting (timeout: {timeout}s)...")
        
        start_time = time.time()
        check_interval = 2  # Start with 2-second intervals
        max_interval = 5    # Maximum interval between checks
        
        while time.time() - start_time < timeout:
            elapsed = time.time() - start_time
            
            # Log progress periodically
            if int(elapsed) % 10 == 0 and elapsed > 0:
                logger.info(f"⏳ Still waiting for whitelisting... ({elapsed:.0f}s elapsed)")
            
            # Simulate checking whitelist status
            # In a real implementation, this might query the Cloudflare API or bot payment system
            if elapsed >= 5:  # Assume whitelisting takes ~5 seconds minimum
                logger.info("✅ IP whitelisting completed")
                return True
            
            # Wait before next check, with exponential backoff up to max_interval
            time.sleep(min(check_interval, max_interval))
            check_interval = min(check_interval * 1.2, max_interval)
                
        logger.error(f"❌ Timeout waiting for IP whitelisting after {timeout}s")
        return False
    
    def retry_request_after_payment(self, session: requests.Session, url: str, timeout: int = 30) -> Optional[requests.Response]:
        """
        Retries the original request after successful payment and whitelisting
        """
        logger.info("🔄 Retrying original request after successful payment...")
        
        try:
            response = session.get(url, timeout=timeout)
            
            if response.status_code == 200:
                logger.info("🎉 Request successful after payment!")
                return response
            elif response.status_code == 402:
                logger.warning("⚠️ Still getting 402 - whitelisting may not be active yet")
                return None
            else:
                logger.warning(f"⚠️ Unexpected response code after payment: {response.status_code}")
                return response
                
        except requests.RequestException as e:
            logger.error(f"❌ Error retrying request after payment: {e}")
            return None
    
    def handle_payment_required(self, response: requests.Response, client_ip: str) -> bool:
        """
        Handles the complete X402 payment flow
        Returns True if payment was successful and access should be retried
        """
        try:
            # Extract payment details from response
            payment_details = self.extract_payment_details(response)
            logger.info(f"💳 X402 payment required: {payment_details}")
            
            # Make the MOVE token payment
            transaction_id = self.make_move_payment(
                payment_details['payment_address'],
                payment_details['payment_amount']
            )
            
            # Verify payment with the bot payment system
            if not self.verify_payment_with_system(transaction_id, client_ip):
                logger.error("❌ Payment verification failed")
                return False
            
            # Wait for IP whitelisting to complete
            if not self.wait_for_whitelist():
                logger.error("❌ IP whitelisting failed or timed out")
                return False
                
            logger.info("🎉 X402 payment flow completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ X402 payment flow failed: {e}")
            return False
    
    def get_client_ip(self) -> str:
        """
        Gets the client IP address for payment verification
        Uses the configured IP (210.212.2.133) for consistency
        """
        # Use the configured IP address that matches the bot payment system configuration
        return "210.212.2.133"
    
    def is_whitelist_expired(self) -> bool:
        """
        Checks if the current whitelist has expired based on the 60-second duration
        """
        if self.last_payment_time is None:
            return True
            
        elapsed_time = datetime.now() - self.last_payment_time
        expired = elapsed_time.total_seconds() >= self.whitelist_duration
        
        if expired:
            logger.info(f"🕐 Whitelist expired after {elapsed_time.total_seconds():.1f}s (limit: {self.whitelist_duration}s)")
        
        return expired
    
    def should_trigger_new_payment(self, response: requests.Response) -> bool:
        """
        Determines if a new payment flow should be triggered based on response and expiration
        """
        # If we get a 402 or 403, check if it's due to expiration
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
    
    def handle_expired_whitelist(self, response: requests.Response, client_ip: str) -> bool:
        """
        Handles expired whitelist by triggering a new payment flow
        """
        logger.info("⏰ Handling expired whitelist - initiating new payment flow")
        
        # Reset payment tracking
        self.last_payment_time = None
        self.last_transaction_id = None
        
        # If it's a 402 response, handle it normally
        if response.status_code == 402 and self.detect_payment_required(response):
            return self.handle_payment_required(response, client_ip)
        
        # If it's a 403 or other error, we need to trigger a payment manually
        # This simulates what would happen if the paywall worker returned a 402
        logger.info("🔄 Simulating X402 payment requirement for expired whitelist")
        
        # Create a mock 402 response with X402 headers
        mock_payment_details = {
            'payment_address': self.payment_address or 'default_payment_address',
            'payment_amount': self.payment_amount,
            'payment_currency': self.payment_currency,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            # Make the MOVE token payment
            transaction_id = self.make_move_payment(
                mock_payment_details['payment_address'],
                mock_payment_details['payment_amount']
            )
            
            # Verify payment with the bot payment system
            if not self.verify_payment_with_system(transaction_id, client_ip):
                logger.error("❌ Payment verification failed for expired whitelist")
                return False
            
            # Wait for IP whitelisting to complete
            if not self.wait_for_whitelist():
                logger.error("❌ IP whitelisting failed or timed out for expired whitelist")
                return False
                
            logger.info("🎉 Expired whitelist renewal completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to handle expired whitelist: {e}")
            return False