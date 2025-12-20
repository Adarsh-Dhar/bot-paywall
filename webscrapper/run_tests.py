#!/usr/bin/env python3
"""
Test runner for X402 Payment Handler
Provides comprehensive testing with different modes
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


def print_banner():
    print("=" * 60)
    print("🧪 X402 Payment Handler Test Suite")
    print("=" * 60)
    print()


def install_test_dependencies():
    """Install test dependencies"""
    print("📦 Installing test dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    return True


def run_unit_tests():
    """Run unit tests with pytest"""
    print("🔬 Running unit tests...")
    
    try:
        # Run pytest with verbose output
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "test_x402_payment_handler.py",
            "-v",
            "--tb=short",
            "--color=yes"
        ], capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        if result.returncode == 0:
            print("✅ All unit tests passed!")
            return True
        else:
            print("❌ Some unit tests failed")
            return False
            
    except Exception as e:
        print(f"❌ Error running unit tests: {e}")
        return False


def run_integration_test():
    """Run integration test against mock system"""
    print("🔗 Running integration test...")
    
    try:
        from x402_payment_handler import X402PaymentHandler
        from unittest.mock import Mock
        import requests
        
        # Create handler
        handler = X402PaymentHandler()
        
        # Test complete flow with mocked responses
        print("  Testing payment detection...")
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123456789abcdef',
            'X402-Payment-Amount': '0.01',
            'X402-Payment-Currency': 'MOVE'
        }
        
        assert handler.detect_payment_required(response)
        print("  ✅ Payment detection works")
        
        print("  Testing payment extraction...")
        details = handler.extract_payment_details(response)
        assert details['payment_amount'] == 0.01
        print("  ✅ Payment extraction works")
        
        print("  Testing MOVE payment...")
        tx_id = handler.make_move_payment(details['payment_address'], details['payment_amount'])
        assert tx_id.startswith('0x')
        print(f"  ✅ Payment successful: {tx_id[:20]}...")
        
        print("  Testing whitelist expiration...")
        assert not handler.is_whitelist_expired()  # Should be fresh
        print("  ✅ Whitelist tracking works")
        
        print("✅ Integration test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False


def run_live_test():
    """Run live test against actual paywall"""
    print("🌐 Running live test against paywall...")
    print("⚠️  This may make real payments if in real transaction mode!")
    
    # Check if user wants to proceed
    response = input("Continue with live test? (y/N): ")
    if response.lower() != 'y':
        print("⏭️ Skipping live test")
        return True
        
    try:
        # Run the live test from the test file
        result = subprocess.run([
            sys.executable, "test_x402_payment_handler.py", "--live"
        ], capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        return result.returncode == 0
        
    except Exception as e:
        print(f"❌ Live test failed: {e}")
        return False


def run_performance_test():
    """Run performance tests"""
    print("⚡ Running performance tests...")
    
    try:
        from x402_payment_handler import X402PaymentHandler
        import time
        
        handler = X402PaymentHandler()
        
        # Test payment processing speed
        print("  Testing payment processing speed...")
        start_time = time.time()
        
        for i in range(5):
            tx_id = handler.make_move_payment("0x123456789abcdef", 0.01)
            assert tx_id.startswith('0x')
            
        elapsed = time.time() - start_time
        avg_time = elapsed / 5
        
        print(f"  ✅ Average payment time: {avg_time:.2f}s")
        
        if avg_time > 5.0:
            print("  ⚠️ Payment processing is slow (>5s)")
        else:
            print("  ✅ Payment processing is fast")
            
        # Test whitelist checking speed
        print("  Testing whitelist checking speed...")
        start_time = time.time()
        
        for i in range(100):
            handler.is_whitelist_expired()
            
        elapsed = time.time() - start_time
        avg_time = elapsed / 100
        
        print(f"  ✅ Average whitelist check time: {avg_time*1000:.2f}ms")
        
        print("✅ Performance tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False


def run_security_test():
    """Run security tests"""
    print("🔒 Running security tests...")
    
    try:
        from x402_payment_handler import X402PaymentHandler
        from unittest.mock import Mock
        
        handler = X402PaymentHandler()
        
        # Test invalid payment amounts
        print("  Testing payment amount validation...")
        try:
            handler.make_move_payment("0x123", 999.99)  # Invalid amount
            print("  ❌ Should have rejected invalid amount")
            return False
        except ValueError:
            print("  ✅ Correctly rejected invalid amount")
            
        # Test invalid response headers
        print("  Testing response validation...")
        response = Mock()
        response.status_code = 402
        response.headers = {
            'WWW-Authenticate': 'X402-Payment required',
            'X402-Payment-Address': '0x123',
            'X402-Payment-Amount': '999.99',  # Invalid amount
            'X402-Payment-Currency': 'MOVE'
        }
        
        try:
            handler.extract_payment_details(response)
            print("  ❌ Should have rejected invalid payment details")
            return False
        except ValueError:
            print("  ✅ Correctly rejected invalid payment details")
            
        # Test transaction ID format validation
        print("  Testing transaction ID validation...")
        valid_tx = handler.make_move_payment("0x123", 0.01)
        assert len(valid_tx) == 66  # 0x + 64 hex chars
        assert valid_tx.startswith('0x')
        print("  ✅ Transaction ID format is secure")
        
        print("✅ Security tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Security test failed: {e}")
        return False


def main():
    """Main test runner"""
    parser = argparse.ArgumentParser(description="X402 Payment Handler Test Suite")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--live", action="store_true", help="Run live tests only")
    parser.add_argument("--performance", action="store_true", help="Run performance tests only")
    parser.add_argument("--security", action="store_true", help="Run security tests only")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    parser.add_argument("--install-deps", action="store_true", help="Install dependencies first")
    
    args = parser.parse_args()
    
    print_banner()
    
    # Install dependencies if requested
    if args.install_deps:
        if not install_test_dependencies():
            sys.exit(1)
    
    # Determine which tests to run
    run_all = args.all or not any([args.unit, args.integration, args.live, args.performance, args.security])
    
    results = []
    
    # Run selected tests
    if run_all or args.unit:
        results.append(("Unit Tests", run_unit_tests()))
        
    if run_all or args.integration:
        results.append(("Integration Tests", run_integration_test()))
        
    if run_all or args.performance:
        results.append(("Performance Tests", run_performance_test()))
        
    if run_all or args.security:
        results.append(("Security Tests", run_security_test()))
        
    if args.live:  # Only run live tests if explicitly requested
        results.append(("Live Tests", run_live_test()))
    
    # Print summary
    print("\n" + "=" * 60)
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
        print("\n💡 Next steps:")
        print("  - Run 'python main.py' to test the webscraper")
        print("  - Check logs for payment transactions")
        print("  - Monitor scraped content in scraped_content/ folder")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        print("\n🔧 Troubleshooting:")
        print("  - Check your .env configuration")
        print("  - Ensure dependencies are installed")
        print("  - Review error messages above")
        sys.exit(1)


if __name__ == "__main__":
    main()