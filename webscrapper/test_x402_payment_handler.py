#!/usr/bin/env python3
"""
Comprehensive test suite for X402 Payment Handler
Tests both mock and real transaction modes
"""

import pytest
import requests
import time
import json
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from x402_payment_handler import X402PaymentHandler


class TestX402PaymentHandler:
    """Test suite for X402PaymentHandler"""
    
    def setup_method(self):
        """Setup test environment before each test"""
        self.handler = X402PaymentHandler(
            payment_address="0x123456789abcdef",
            bot_payment_system_url="http://localhost:3000/api/x402-payment"
        )
        
    def test_initialization(self):
        """Test handler initialization"""
        assert self.handler.payment_amount == 0.01
        assert self.handler.payment_currency == "MOVE"
        assert self.handler.whitelist_duration == 60
        assert self.handler.last_payment_time is None
        assert self.handler.last_transaction_id is None
        
    def test_detect_payment_required_valid_402(self):
        """Test detection of valid X402 payment requirement"""
        # Create mock response with X402 headers
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        assert self.handler.detect_payment_required(response) is True
        
    def test_detect_payment_required_invalid_402(self):
        """Test detection fails for invalid 402 response"""
        # Missing X402 headers
        response = Mock()
        response.status_code = 402
        response.headers = {'WWW-Authenticate': 'Basic realm="test"'}
        
        assert self.handler.detect_payment_required(response) is False
        
    def test_detect_payment_required_non_402(self):
        """Test detection fails for non-402 responses"""
        response = Mock()
        response.status_code = 200
        response.headers = {}
        
        assert self.handler.detect_payment_required(response) is False
        
    def test_extract_payment_details_valid(self):
        """Test extraction of valid payment details"""
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123456789abcdef',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        details = self.handler.extract_payment_details(response)
        
        assert details['payment_address'] == '0x123456789abcdef'
        assert details['payment_amount'] == 0.01
        assert details['payment_currency'] == 'MOVE'
        assert 'timestamp' in details
        
    def test_extract_payment_details_invalid_amount(self):
        """Test extraction fails with invalid amount"""
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123',
            'X402-Payment-Amount': '0.02',  # Wrong amount
            'X402-Payment-Currency': 'MOVE'
        }
        
        with pytest.raises(ValueError, match="Unexpected payment amount"):
            self.handler.extract_payment_details(response)
            
    def test_extract_payment_details_invalid_currency(self):
        """Test extraction fails with invalid currency"""
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'BTC'  # Wrong currency
        }
        
        with pytest.raises(ValueError, match="Unexpected payment currency"):
            self.handler.extract_payment_details(response)
            
    def test_make_move_payment_success(self):
        """Test successful MOVE payment"""
        payment_address = "0x123456789abcdef"
        amount = 0.01
        
        transaction_id = self.handler.make_move_payment(payment_address, amount)
        
        # Verify transaction ID format
        assert transaction_id.startswith('0x')
        assert len(transaction_id) == 66  # 0x + 64 hex chars
        
        # Verify payment tracking
        assert self.handler.last_payment_time is not None
        assert self.handler.last_transaction_id == transaction_id
        
    def test_make_move_payment_invalid_amount(self):
        """Test payment fails with invalid amount"""
        with pytest.raises(ValueError, match="Invalid payment amount"):
            self.handler.make_move_payment("0x123", 0.02)
            
    @patch('requests.post')
    def test_verify_payment_with_system_success(self, mock_post):
        """Test successful payment verification"""
        # Mock successful verification response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'verified': True}
        mock_post.return_value = mock_response
        
        result = self.handler.verify_payment_with_system("0x123", "210.212.2.133")
        
        assert result is True
        mock_post.assert_called_once()
        
    @patch('requests.post')
    def test_verify_payment_with_system_failure(self, mock_post):
        """Test failed payment verification"""
        # Mock failed verification response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'verified': False, 'error': 'Invalid transaction'}
        mock_post.return_value = mock_response
        
        result = self.handler.verify_payment_with_system("0x123", "210.212.2.133")
        
        assert result is False
        
    @patch('requests.post')
    def test_verify_payment_connection_error_mock_success(self, mock_post):
        """Test mock verification when connection fails"""
        # Mock connection error
        mock_post.side_effect = requests.ConnectionError("Connection refused")
        
        # Valid transaction ID should pass mock verification
        result = self.handler.verify_payment_with_system("0x" + "a" * 64, "210.212.2.133")
        
        assert result is True
        
    @patch('requests.post')
    def test_verify_payment_connection_error_mock_failure(self, mock_post):
        """Test mock verification fails with invalid transaction ID"""
        # Mock connection error
        mock_post.side_effect = requests.ConnectionError("Connection refused")
        
        # Invalid transaction ID should fail mock verification
        result = self.handler.verify_payment_with_system("invalid_tx_id", "210.212.2.133")
        
        assert result is False
        
    def test_wait_for_whitelist_success(self):
        """Test successful whitelist waiting"""
        # Should complete after minimum wait time
        start_time = time.time()
        result = self.handler.wait_for_whitelist(timeout=10)
        elapsed = time.time() - start_time
        
        assert result is True
        assert elapsed >= 5  # Minimum wait time
        assert elapsed < 10  # Should complete before timeout
        
    def test_wait_for_whitelist_timeout(self):
        """Test whitelist waiting timeout"""
        # Use very short timeout to test timeout behavior
        start_time = time.time()
        result = self.handler.wait_for_whitelist(timeout=2)
        elapsed = time.time() - start_time
        
        assert result is False
        assert elapsed >= 2  # Should wait full timeout
        
    def test_get_client_ip(self):
        """Test client IP retrieval"""
        ip = self.handler.get_client_ip()
        assert ip == "210.212.2.133"
        
    def test_is_whitelist_expired_no_payment(self):
        """Test whitelist expiration with no previous payment"""
        assert self.handler.is_whitelist_expired() is True
        
    def test_is_whitelist_expired_recent_payment(self):
        """Test whitelist not expired with recent payment"""
        self.handler.last_payment_time = datetime.now()
        assert self.handler.is_whitelist_expired() is False
        
    def test_is_whitelist_expired_old_payment(self):
        """Test whitelist expired with old payment"""
        self.handler.last_payment_time = datetime.now() - timedelta(seconds=70)
        assert self.handler.is_whitelist_expired() is True
        
    def test_should_trigger_new_payment_402_with_x402(self):
        """Test triggering payment for 402 with X402 headers"""
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        assert self.handler.should_trigger_new_payment(response) is True
        
    def test_should_trigger_new_payment_403_expired(self):
        """Test triggering payment for 403 with expired whitelist"""
        response = Mock()
        response.status_code = 403
        
        # Set expired payment time
        self.handler.last_payment_time = datetime.now() - timedelta(seconds=70)
        
        assert self.handler.should_trigger_new_payment(response) is True
        
    def test_should_trigger_new_payment_200_success(self):
        """Test not triggering payment for successful response"""
        response = Mock()
        response.status_code = 200
        
        assert self.handler.should_trigger_new_payment(response) is False
        
    @patch.object(X402PaymentHandler, 'make_move_payment')
    @patch.object(X402PaymentHandler, 'verify_payment_with_system')
    @patch.object(X402PaymentHandler, 'wait_for_whitelist')
    def test_handle_payment_required_success(self, mock_wait, mock_verify, mock_payment):
        """Test successful complete payment flow"""
        # Setup mocks
        mock_payment.return_value = "0x123456789abcdef"
        mock_verify.return_value = True
        mock_wait.return_value = True
        
        # Create valid 402 response
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123456789abcdef',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        result = self.handler.handle_payment_required(response, "210.212.2.133")
        
        assert result is True
        mock_payment.assert_called_once_with('0x123456789abcdef', 0.01)
        mock_verify.assert_called_once_with("0x123456789abcdef", "210.212.2.133")
        mock_wait.assert_called_once()
        
    @patch.object(X402PaymentHandler, 'make_move_payment')
    @patch.object(X402PaymentHandler, 'verify_payment_with_system')
    def test_handle_payment_required_verification_failure(self, mock_verify, mock_payment):
        """Test payment flow with verification failure"""
        # Setup mocks
        mock_payment.return_value = "0x123456789abcdef"
        mock_verify.return_value = False  # Verification fails
        
        # Create valid 402 response
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123456789abcdef',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        result = self.handler.handle_payment_required(response, "210.212.2.133")
        
        assert result is False
        
    @patch.object(X402PaymentHandler, 'make_move_payment')
    @patch.object(X402PaymentHandler, 'verify_payment_with_system')
    @patch.object(X402PaymentHandler, 'wait_for_whitelist')
    def test_handle_expired_whitelist_success(self, mock_wait, mock_verify, mock_payment):
        """Test successful expired whitelist handling"""
        # Setup mocks
        mock_payment.return_value = "0x123456789abcdef"
        mock_verify.return_value = True
        mock_wait.return_value = True
        
        # Create 403 response (expired whitelist)
        response = Mock()
        response.status_code = 403
        
        result = self.handler.handle_expired_whitelist(response, "210.212.2.133")
        
        assert result is True
        # Should reset payment tracking
        assert self.handler.last_payment_time is not None  # Set by make_move_payment
        
    def test_integration_payment_flow(self):
        """Integration test of complete payment flow"""
        # Create a realistic 402 response
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123456789abcdef',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        # Mock the verification to succeed (simulating offline mode)
        with patch('requests.post') as mock_post:
            mock_post.side_effect = requests.ConnectionError("Connection refused")
            
            # This should succeed with mock verification
            result = self.handler.handle_payment_required(response, "210.212.2.133")
            
            assert result is True
            assert self.handler.last_payment_time is not None
            assert self.handler.last_transaction_id is not None
            assert self.handler.last_transaction_id.startswith('0x')


class TestX402PaymentHandlerRealMode:
    """Test suite for real transaction mode (requires environment setup)"""
    
    def setup_method(self):
        """Setup test environment for real mode tests"""
        # Only run these tests if explicitly configured for real mode
        self.real_mode = os.getenv('X402_REAL_TX_MODE', 'false').lower() == 'true'
        
        if self.real_mode:
            self.handler = X402PaymentHandler()
        else:
            pytest.skip("Real transaction mode not enabled (set X402_REAL_TX_MODE=true)")
            
    def test_real_mode_initialization(self):
        """Test initialization in real mode"""
        if not self.real_mode:
            pytest.skip("Real mode not enabled")
            
        # These tests would require actual blockchain setup
        # For now, just verify the handler can be created
        assert self.handler is not None


def run_live_test():
    """
    Run a live test against the actual paywall system
    This is separate from pytest to avoid accidental charges
    """
    print("🧪 Running live X402 payment test...")
    print("⚠️  This will make a real payment if in real transaction mode!")
    
    # Ask for confirmation
    response = input("Continue with live test? (y/N): ")
    if response.lower() != 'y':
        print("❌ Live test cancelled")
        return
        
    try:
        # Initialize handler
        handler = X402PaymentHandler()
        
        # Test against actual paywall
        target_url = os.getenv("TARGET_URL", "https://paywall-worker.dharadarsh0.workers.dev/")
        
        print(f"🎯 Testing against: {target_url}")
        
        # Make initial request
        session = requests.Session()
        session.headers.update({"User-Agent": "Python-WebScraper/1.0 (Bot)"})
        
        response = session.get(target_url, timeout=30)
        print(f"📡 Initial response: {response.status_code}")
        
        # Check if payment is required
        if handler.should_trigger_new_payment(response):
            print("💳 Payment required, processing...")
            
            client_ip = handler.get_client_ip()
            
            if response.status_code == 402 and handler.detect_payment_required(response):
                success = handler.handle_payment_required(response, client_ip)
            else:
                success = handler.handle_expired_whitelist(response, client_ip)
                
            if success:
                print("✅ Payment successful, retrying request...")
                
                # Retry the request
                retry_response = session.get(target_url, timeout=30)
                print(f"🔄 Retry response: {retry_response.status_code}")
                
                if retry_response.status_code == 200:
                    print("🎉 Live test successful!")
                    print(f"📄 Content length: {len(retry_response.text)} characters")
                else:
                    print(f"⚠️ Unexpected retry response: {retry_response.status_code}")
            else:
                print("❌ Payment failed")
        else:
            print("✅ No payment required, access granted")
            
    except Exception as e:
        print(f"❌ Live test failed: {e}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        run_live_test()
    else:
        # Run pytest
        pytest.main([__file__, "-v"])