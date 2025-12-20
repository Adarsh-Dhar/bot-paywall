#!/usr/bin/env python3
"""
Analyze the new paywall at test-cloudflare-website.adarsh.software
"""

import requests
import logging
import json
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def analyze_paywall_response(url):
    """Analyze the paywall response in detail"""
    logger.info(f"🔍 Analyzing paywall: {url}")
    
    # Test 1: Basic request
    logger.info("\n" + "="*60)
    logger.info("TEST 1: Basic Request Analysis")
    logger.info("="*60)
    
    try:
        response = requests.get(url, timeout=30)
        
        logger.info(f"Status Code: {response.status_code}")
        logger.info(f"Reason: {response.reason}")
        
        logger.info("\nResponse Headers:")
        for key, value in response.headers.items():
            logger.info(f"  {key}: {value}")
        
        logger.info(f"\nContent Length: {len(response.text)} characters")
        logger.info(f"Content Preview:")
        logger.info(response.text[:500])
        
        # Check for X402 headers
        x402_headers = {}
        payment_headers = {}
        
        for key, value in response.headers.items():
            if 'x402' in key.lower() or 'payment' in key.lower():
                payment_headers[key] = value
            if key.lower() == 'www-authenticate':
                x402_headers[key] = value
        
        if payment_headers:
            logger.info("\n💳 Payment-related headers found:")
            for key, value in payment_headers.items():
                logger.info(f"  {key}: {value}")
        
        if x402_headers:
            logger.info("\n🔐 Authentication headers found:")
            for key, value in x402_headers.items():
                logger.info(f"  {key}: {value}")
        
        # Check if it's a proper X402 response
        www_auth = response.headers.get('WWW-Authenticate', '')
        if response.status_code == 402:
            logger.info("\n✅ This is a 402 Payment Required response")
            if 'X402' in www_auth:
                logger.info("✅ X402 protocol detected")
                
                # Extract X402 details
                required_headers = ['X402-Payment-Address', 'X402-Payment-Amount', 'X402-Payment-Currency']
                missing_headers = []
                
                for header in required_headers:
                    if header not in response.headers:
                        missing_headers.append(header)
                
                if not missing_headers:
                    logger.info("✅ All required X402 headers present")
                    logger.info("💰 Payment Details:")
                    logger.info(f"  Address: {response.headers.get('X402-Payment-Address')}")
                    logger.info(f"  Amount: {response.headers.get('X402-Payment-Amount')}")
                    logger.info(f"  Currency: {response.headers.get('X402-Payment-Currency')}")
                else:
                    logger.warning(f"⚠️ Missing X402 headers: {missing_headers}")
            else:
                logger.warning("⚠️ 402 response but no X402 protocol detected")
        elif response.status_code == 403:
            logger.info("\n❌ This is a 403 Forbidden response")
            logger.info("This might indicate:")
            logger.info("  - IP-based blocking")
            logger.info("  - Bot detection")
            logger.info("  - Missing payment verification")
            logger.info("  - Expired whitelist")
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Error analyzing paywall: {e}")
        return None


def test_bot_payment_system():
    """Test if the bot payment system is running and accessible"""
    logger.info("\n" + "="*60)
    logger.info("TEST 2: Bot Payment System Check")
    logger.info("="*60)
    
    bot_system_url = "http://localhost:3000"
    
    try:
        # Test main endpoint
        logger.info(f"Testing bot payment system at: {bot_system_url}")
        response = requests.get(f"{bot_system_url}/api/x402-payment", timeout=10)
        
        if response.status_code == 200:
            logger.info("✅ Bot payment system is running")
            logger.info(f"Response: {response.text}")
            return True
        else:
            logger.warning(f"⚠️ Bot payment system returned {response.status_code}")
            logger.info(f"Response: {response.text}")
            return False
            
    except requests.ConnectionError:
        logger.error("❌ Bot payment system is not running")
        logger.info("💡 To start the bot payment system:")
        logger.info("   1. Navigate to the bot payment system directory")
        logger.info("   2. Run: npm install && npm start")
        logger.info("   3. Or check if it's running on a different port")
        return False
    except Exception as e:
        logger.error(f"❌ Error testing bot payment system: {e}")
        return False


def suggest_next_steps(paywall_response, bot_system_running):
    """Suggest next steps based on analysis"""
    logger.info("\n" + "="*60)
    logger.info("RECOMMENDED NEXT STEPS")
    logger.info("="*60)
    
    if not paywall_response:
        logger.info("❌ Could not analyze paywall - check network connectivity")
        return
    
    if paywall_response.status_code == 402:
        logger.info("🎯 This is a proper X402 paywall!")
        
        www_auth = paywall_response.headers.get('WWW-Authenticate', '')
        if 'X402' in www_auth:
            required_headers = ['X402-Payment-Address', 'X402-Payment-Amount', 'X402-Payment-Currency']
            has_all_headers = all(h in paywall_response.headers for h in required_headers)
            
            if has_all_headers:
                logger.info("✅ All X402 headers present - payment system should work")
                
                if bot_system_running:
                    logger.info("✅ Bot payment system is running")
                    logger.info("🚀 Ready to process X402 payments!")
                    logger.info("\nNext steps:")
                    logger.info("  1. Run: python enhanced_webscraper.py")
                    logger.info("  2. The system should automatically handle X402 payments")
                else:
                    logger.info("❌ Bot payment system is not running")
                    logger.info("\nNext steps:")
                    logger.info("  1. Start the bot payment system (localhost:3000)")
                    logger.info("  2. Then run: python enhanced_webscraper.py")
            else:
                logger.warning("⚠️ Missing some X402 headers")
                logger.info("The paywall might have a non-standard X402 implementation")
        else:
            logger.warning("⚠️ 402 response but no X402 protocol")
            logger.info("This might be a different payment system")
    
    elif paywall_response.status_code == 403:
        logger.info("🚫 This is a 403 Forbidden response")
        
        # Check if it's bot protection
        content = paywall_response.text.lower()
        if 'bot' in content or 'automated' in content or 'scraping' in content:
            logger.info("🤖 Detected bot protection")
            logger.info("This paywall blocks bots regardless of payment")
            
            if bot_system_running:
                logger.info("💡 Try these approaches:")
                logger.info("  1. Check if the bot payment system has whitelist functionality")
                logger.info("  2. Verify IP whitelisting is working")
                logger.info("  3. Test with different user agents")
            else:
                logger.info("❌ Bot payment system not running")
                logger.info("💡 Start the bot payment system first:")
                logger.info("  1. Start bot payment system (localhost:3000)")
                logger.info("  2. Make a payment to get whitelisted")
                logger.info("  3. Then try scraping")
        else:
            logger.info("🔒 Generic 403 - might need authentication")
            logger.info("Check if this requires:")
            logger.info("  - API keys")
            logger.info("  - Special headers")
            logger.info("  - Different authentication method")
    
    else:
        logger.info(f"❓ Unexpected response code: {paywall_response.status_code}")
        logger.info("This might not be a paywall or might use a different system")


def main():
    """Main analysis function"""
    logger.info("🚀 Starting New Paywall Analysis")
    logger.info(f"Timestamp: {datetime.now()}")
    
    url = "https://test-cloudflare-website.adarsh.software/"
    
    # Analyze the paywall
    paywall_response = analyze_paywall_response(url)
    
    # Test bot payment system
    bot_system_running = test_bot_payment_system()
    
    # Suggest next steps
    suggest_next_steps(paywall_response, bot_system_running)
    
    logger.info("\n" + "="*60)
    logger.info("ANALYSIS COMPLETE")
    logger.info("="*60)


if __name__ == "__main__":
    main()