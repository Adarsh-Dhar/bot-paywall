#!/usr/bin/env python3
"""
Simple test runner that bypasses pytest plugin issues
"""

import sys
import traceback
from x402_payment_handler import X402PaymentHandler
from unittest.mock import Mock
import requests


def test_payment_detection():
    """Test payment detection functionality"""
    print("🔬 Testing payment detection...")
    
    handler = X402PaymentHandler()
    
    # Test valid 402 response
    response = Mock()
    response.status_code = 402
    response.headers = {
        'WWW-Authenticate': 'X402-Payment required',
        'X402-Payment-Address': '0x123',
        'X402-Payment-Amount': '0.01',
        'X402-Payment-Currency': 'MOVE'
    }
    
    assert handler.detect_payment_required(response) == True
    print("  ✅ Valid 402 detection works")
    
    # Test invalid 402 response
    response.headers = {'WWW-Authenticate': 'Basic realm="test"'}
    assert handler.detect_payment_required(response) == False
    print("  ✅ Invalid 402 rejection works")
    
    # Test non-402 response
    response.status_code = 200
    assert handler.detect_payment_required(response) == False
    print("  ✅ Non-402 rejection works")
    
    return True


def test_payment_extraction():
    """Test payment detail extraction"""
    print("🔬 Testing payment extraction...")
    
    handler = X402PaymentHandler()
    
    response = Mock()
    response.status_code = 402
    response.headers = {
        'WWW-Authenticate': 'X402-Payment required',
        'X402-Payment-Address': '0x123456789abcdef',
        'X402-Payment-Amount': '0.01',
        'X402-Payment-Currency': 'MOVE'
    }
    
    details = handler.extract_payment_details(response)
    
    assert details['payment_address'] == '0x123456789abcdef'
    assert details['payment_amount'] == 0.01
    assert details['payment_currency'] == 'MOVE'
    assert 'timestamp' in details
    print("  ✅ Payment extraction works")
    
    # Test invalid amount
    response.headers['X402-Payment-Amount'] = '0.02'
    try:
        handler.extract_payment_details(response)
        assert False, "Should have raised ValueError"
    except ValueError:
        print("  ✅ Invalid amount rejection works")
    
    return True


def test_move_payment():
    """Test MOVE payment functionality"""
    print("🔬 Testing MOVE payment...")
    
    handler = X402PaymentHandler()
    
    tx_id = handler.make_move_payment("0x123456789abcdef", 0.01)
    
    assert tx_id.startswith('0x')
    assert len(tx_id) == 66
    assert handler.last_payment_time is not None
    assert handler.last_transaction_id == tx_id
    print(f"  ✅ Payment successful: {tx_id[:20]}...")
    
    # Test invalid amount
    try:
        handler.make_move_payment("0x123", 0.02)
        assert False, "Should have raised ValueError"
    except ValueError:
        print("  ✅ Invalid amount rejection works")
    
    return True


def test_whitelist_expiration():
    """Test whitelist expiration logic"""
    print("🔬 Testing whitelist expiration...")
    
    handler = X402PaymentHandler()
    
    # No payment yet
    assert handler.is_whitelist_expired() == True
    print("  ✅ No payment expiration works")
    
    # Fresh payment
    handler.make_move_payment("0x123", 0.01)
    assert handler.is_whitelist_expired() == False
    print("  ✅ Fresh payment not expired")
    
    # Simulate expired payment
    from datetime import datetime, timedelta
    handler.last_payment_time = datetime.now() - timedelta(seconds=70)
    assert handler.is_whitelist_expired() == True
    print("  ✅ Expired payment detection works")
    
    return True


def test_payment_verification():
    """Test payment verification with mock system"""
    print("🔬 Testing payment verification...")
    
    handler = X402PaymentHandler()
    
    # Test with connection error (should use mock verification)
    tx_id = "0x" + "a" * 64  # Valid format
    result = handler.verify_payment_with_system(tx_id, "210.212.2.133")
    
    # This should succeed with mock verification due to connection error
    print(f"  ✅ Mock verification result: {result}")
    
    return True


def test_complete_flow():
    """Test complete payment flow"""
    print("🔬 Testing complete payment flow...")
    
    handler = X402PaymentHandler()
    
    # Create realistic 402 response
    response = Mock()
    response.status_code = 402
    response.headers = {
        'WWW-Authenticate': 'X402-Payment required',
        'X402-Payment-Address': '0x123456789abcdef',
        'X402-Payment-Amount': '0.01',
        'X402-Payment-Currency': 'MOVE'
    }
    
    # Test complete flow
    result = handler.handle_payment_required(response, "210.212.2.133")
    
    assert result == True
    assert handler.last_payment_time is not None
    assert handler.last_transaction_id is not None
    print("  ✅ Complete payment flow works")
    
    return True


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("🧪 X402 Payment Handler Simple Test Suite")
    print("=" * 60)
    print()
    
    tests = [
        ("Payment Detection", test_payment_detection),
        ("Payment Extraction", test_payment_extraction),
        ("MOVE Payment", test_move_payment),
        ("Whitelist Expiration", test_whitelist_expiration),
        ("Payment Verification", test_payment_verification),
        ("Complete Flow", test_complete_flow),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
            print(f"✅ {test_name} PASSED\n")
        except Exception as e:
            results.append((test_name, False))
            print(f"❌ {test_name} FAILED: {e}")
            traceback.print_exc()
            print()
    
    # Print summary
    print("=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("🎉 All tests passed!")
        return True
    else:
        print("❌ Some tests failed!")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)