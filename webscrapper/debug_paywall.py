#!/usr/bin/env python3
"""
Debug script to analyze paywall responses and identify X402 payment issues
"""

import requests
import logging
import json
from datetime import datetime
from x402_payment_handler import X402PaymentHandler

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('debug_paywall.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def analyze_response(response, step_name):
    """Analyze and log detailed response information"""
    logger.info(f"=" * 60)
    logger.info(f"RESPONSE ANALYSIS: {step_name}")
    logger.info(f"=" * 60)
    logger.info(f"Status Code: {response.status_code}")
    logger.info(f"Reason: {response.reason}")
    logger.info(f"URL: {response.url}")
    
    logger.info("\nResponse Headers:")
    for key, value in response.headers.items():
        logger.info(f"  {key}: {value}")
    
    logger.info(f"\nContent Length: {len(response.text)} characters")
    logger.info(f"Content Preview (first 500 chars):")
    logger.info(response.text[:500])
    
    # Check for X402 specific headers
    x402_headers = [h for h in response.headers.keys() if 'x402' in h.lower() or 'payment' in h.lower()]
    if x402_headers:
        logger.info(f"\nX402/Payment Related Headers Found:")
        for header in x402_headers:
            logger.info(f"  {header}: {response.headers[header]}")
    else:
        logger.info("\nNo X402/Payment headers found")
    
    # Check WWW-Authenticate header specifically
    www_auth = response.headers.get('WWW-Authenticate', '')
    if www_auth:
        logger.info(f"\nWWW-Authenticate: {www_auth}")
        if 'X402' in www_auth:
            logger.info("✅ X402 authentication detected")
        else:
            logger.info("❌ No X402 authentication found")
    else:
        logger.info("\n❌ No WWW-Authenticate header")
    
    return response


def test_paywall_behavior():
    """Test paywall behavior with different approaches"""
    logger.info("🔍 Starting comprehensive paywall analysis...")
    
    url = "https://paywall-worker.dharadarsh0.workers.dev/"
    handler = X402PaymentHandler()
    
    # Test 1: Basic request with minimal headers
    logger.info("\n" + "=" * 80)
    logger.info("TEST 1: Basic Request")
    logger.info("=" * 80)
    
    try:
        session = requests.Session()
        response = session.get(url, timeout=30)
        analyze_response(response, "Basic Request")
        
        if response.status_code == 402:
            logger.info("✅ Got 402 - this is expected for X402 paywall")
            if handler.detect_payment_required(response):
                logger.info("✅ Valid X402 payment requirement detected")
            else:
                logger.error("❌ Invalid X402 headers in 402 response")
        elif response.status_code == 403:
            logger.warning("⚠️ Got 403 - may indicate IP-based blocking or different auth method")
        elif response.status_code == 200:
            logger.info("✅ Got 200 - content is accessible without payment")
        else:
            logger.warning(f"⚠️ Unexpected status code: {response.status_code}")
            
    except Exception as e:
        logger.error(f"❌ Basic request failed: {e}")
    
    # Test 2: Request with bot user agent
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: Request with Bot User Agent")
    logger.info("=" * 80)
    
    try:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Python-WebScraper/1.0 (Bot)"
        })
        response = session.get(url, timeout=30)
        analyze_response(response, "Bot User Agent Request")
        
    except Exception as e:
        logger.error(f"❌ Bot user agent request failed: {e}")
    
    # Test 3: Request with different IP simulation
    logger.info("\n" + "=" * 80)
    logger.info("TEST 3: Request with IP Headers")
    logger.info("=" * 80)
    
    try:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Python-WebScraper/1.0 (Bot)",
            "X-Forwarded-For": "210.212.2.133",
            "X-Real-IP": "210.212.2.133",
            "CF-Connecting-IP": "210.212.2.133"
        })
        response = session.get(url, timeout=30)
        analyze_response(response, "IP Headers Request")
        
    except Exception as e:
        logger.error(f"❌ IP headers request failed: {e}")
    
    # Test 4: Request with payment headers (simulate paid access)
    logger.info("\n" + "=" * 80)
    logger.info("TEST 4: Request with Payment Simulation Headers")
    logger.info("=" * 80)
    
    try:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Python-WebScraper/1.0 (Bot)",
            "X-Payment-Verified": "true",
            "X-Transaction-ID": "0x91285303c6ef0dd28df9c0ec3677cb933817ce966541dbbe6e9b5ca4ab73ec85",
            "X-Client-IP": "210.212.2.133",
            "Authorization": "X402-Payment verified"
        })
        response = session.get(url, timeout=30)
        analyze_response(response, "Payment Simulation Request")
        
    except Exception as e:
        logger.error(f"❌ Payment simulation request failed: {e}")
    
    # Test 5: Check if it's a Cloudflare Worker issue
    logger.info("\n" + "=" * 80)
    logger.info("TEST 5: Cloudflare Worker Analysis")
    logger.info("=" * 80)
    
    try:
        session = requests.Session()
        response = session.get(url, timeout=30)
        
        # Check for Cloudflare headers
        cf_headers = [h for h in response.headers.keys() if 'cf-' in h.lower() or 'cloudflare' in h.lower()]
        if cf_headers:
            logger.info("🔍 Cloudflare headers detected:")
            for header in cf_headers:
                logger.info(f"  {header}: {response.headers[header]}")
        
        # Check for worker-specific headers
        worker_headers = [h for h in response.headers.keys() if 'worker' in h.lower()]
        if worker_headers:
            logger.info("🔍 Worker headers detected:")
            for header in worker_headers:
                logger.info(f"  {header}: {response.headers[header]}")
                
    except Exception as e:
        logger.error(f"❌ Cloudflare analysis failed: {e}")


def test_payment_system_integration():
    """Test if our payment system matches the paywall's expectations"""
    logger.info("\n" + "=" * 80)
    logger.info("PAYMENT SYSTEM INTEGRATION TEST")
    logger.info("=" * 80)
    
    handler = X402PaymentHandler()
    
    # Test payment system configuration
    logger.info("Payment System Configuration:")
    logger.info(f"  Bot Payment System URL: {handler.bot_payment_system_url}")
    logger.info(f"  Payment Amount: {handler.payment_amount} {handler.payment_currency}")
    logger.info(f"  Whitelist Duration: {handler.whitelist_duration} seconds")
    logger.info(f"  Client IP: {handler.get_client_ip()}")
    
    # Test if bot payment system is reachable
    try:
        verify_url = f"{handler.bot_payment_system_url}/verify"
        logger.info(f"\nTesting bot payment system connectivity: {verify_url}")
        
        test_payload = {
            'transactionId': '0x1234567890abcdef',
            'clientIP': handler.get_client_ip(),
            'expectedAmount': handler.payment_amount,
            'expectedCurrency': handler.payment_currency
        }
        
        response = requests.post(
            verify_url,
            json=test_payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        logger.info(f"Bot payment system response: {response.status_code}")
        if response.status_code == 200:
            logger.info("✅ Bot payment system is reachable")
            logger.info(f"Response: {response.text}")
        else:
            logger.warning(f"⚠️ Bot payment system returned {response.status_code}")
            
    except requests.ConnectionError:
        logger.warning("⚠️ Bot payment system not reachable (expected in development)")
    except Exception as e:
        logger.error(f"❌ Bot payment system test failed: {e}")


def suggest_solutions():
    """Analyze results and suggest solutions"""
    logger.info("\n" + "=" * 80)
    logger.info("SOLUTION ANALYSIS")
    logger.info("=" * 80)
    
    logger.info("Based on the analysis, here are potential issues and solutions:")
    
    logger.info("\n1. 403 Forbidden Response Analysis:")
    logger.info("   - If getting 403 instead of 402, the paywall might:")
    logger.info("     a) Use IP-based blocking instead of X402")
    logger.info("     b) Require specific headers or authentication")
    logger.info("     c) Have different payment verification method")
    
    logger.info("\n2. Payment Verification Issues:")
    logger.info("   - Our payment system works correctly (mock mode)")
    logger.info("   - But paywall might not recognize our payments because:")
    logger.info("     a) Different payment verification endpoint")
    logger.info("     b) Different transaction format expected")
    logger.info("     c) Missing integration with actual payment system")
    
    logger.info("\n3. Recommended Solutions:")
    logger.info("   a) Check if paywall expects different headers")
    logger.info("   b) Verify payment system integration")
    logger.info("   c) Test with actual bot payment system running")
    logger.info("   d) Check Cloudflare Worker configuration")
    
    logger.info("\n4. Next Steps:")
    logger.info("   - Start the bot payment system (localhost:3000)")
    logger.info("   - Configure real MOVE transactions if needed")
    logger.info("   - Check paywall worker source code for requirements")


def main():
    """Main debug function"""
    logger.info("🚀 Starting Paywall Debug Analysis")
    logger.info(f"Timestamp: {datetime.now()}")
    
    try:
        test_paywall_behavior()
        test_payment_system_integration()
        suggest_solutions()
        
        logger.info("\n" + "=" * 80)
        logger.info("DEBUG ANALYSIS COMPLETE")
        logger.info("=" * 80)
        logger.info("Check debug_paywall.log for detailed analysis")
        
    except Exception as e:
        logger.error(f"❌ Debug analysis failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()