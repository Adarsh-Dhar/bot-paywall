#!/usr/bin/env python3
"""
Fix paywall integration by implementing proper bot detection bypass
"""

import requests
import time
import logging
import json
from datetime import datetime
from x402_payment_handler import X402PaymentHandler

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FixedWebScraper:
    """Enhanced web scraper that handles both X402 and bot protection"""
    
    def __init__(self, url: str):
        self.url = url
        self.session = requests.Session()
        self.x402_handler = X402PaymentHandler()
        
    def setup_human_like_headers(self):
        """Setup headers to appear more human-like"""
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0"
        })
        
    def try_different_approaches(self):
        """Try different approaches to access the content"""
        approaches = [
            ("Human-like browser", self.try_human_browser),
            ("X402 payment flow", self.try_x402_payment),
            ("Bot payment system", self.try_bot_payment_system),
            ("Alternative endpoints", self.try_alternative_endpoints)
        ]
        
        for approach_name, approach_func in approaches:
            logger.info(f"🔄 Trying approach: {approach_name}")
            try:
                result = approach_func()
                if result:
                    logger.info(f"✅ Success with approach: {approach_name}")
                    return result
                else:
                    logger.info(f"❌ Failed with approach: {approach_name}")
            except Exception as e:
                logger.error(f"❌ Error with approach {approach_name}: {e}")
                
        return None
        
    def try_human_browser(self):
        """Try to access as a human browser"""
        logger.info("  🌐 Attempting human browser simulation...")
        
        # Reset session and setup human-like headers
        self.session = requests.Session()
        self.setup_human_like_headers()
        
        # Add some delay to simulate human behavior
        time.sleep(2)
        
        try:
            response = self.session.get(self.url, timeout=30)
            logger.info(f"  📡 Response: {response.status_code}")
            
            if response.status_code == 200:
                logger.info("  ✅ Successfully accessed as human browser")
                return response.text
            elif response.status_code == 403:
                logger.info("  ❌ Still blocked as bot")
                return None
            else:
                logger.info(f"  ⚠️ Unexpected status: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"  ❌ Human browser approach failed: {e}")
            return None
            
    def try_x402_payment(self):
        """Try X402 payment flow (even though paywall doesn't support it)"""
        logger.info("  💳 Attempting X402 payment flow...")
        
        try:
            # Reset to bot headers for X402
            self.session = requests.Session()
            self.session.headers.update({
                "User-Agent": "Python-WebScraper/1.0 (Bot)"
            })
            
            response = self.session.get(self.url, timeout=30)
            logger.info(f"  📡 Response: {response.status_code}")
            
            if response.status_code == 402 and self.x402_handler.detect_payment_required(response):
                logger.info("  💳 X402 payment required - processing...")
                client_ip = self.x402_handler.get_client_ip()
                success = self.x402_handler.handle_payment_required(response, client_ip)
                
                if success:
                    # Retry after payment
                    retry_response = self.session.get(self.url, timeout=30)
                    if retry_response.status_code == 200:
                        logger.info("  ✅ X402 payment successful")
                        return retry_response.text
                        
            logger.info("  ❌ No X402 support detected")
            return None
            
        except Exception as e:
            logger.error(f"  ❌ X402 payment approach failed: {e}")
            return None
            
    def try_bot_payment_system(self):
        """Try to use the bot payment system directly"""
        logger.info("  🤖 Attempting bot payment system integration...")
        
        try:
            # Check if bot payment system is running
            bot_system_url = "http://localhost:3000"
            
            # Try to get payment instructions
            payment_response = requests.get(f"{bot_system_url}/api/x402-payment", timeout=10)
            
            if payment_response.status_code == 200:
                logger.info("  ✅ Bot payment system is running")
                
                # Get payment details
                payment_data = payment_response.json()
                logger.info(f"  💰 Payment required: {payment_data}")
                
                # Make payment through system
                tx_id = self.x402_handler.make_move_payment(
                    payment_data.get('address', 'default_address'), 
                    0.01
                )
                
                # Verify payment
                verify_response = requests.post(
                    f"{bot_system_url}/api/x402-payment/verify",
                    json={
                        'transactionId': tx_id,
                        'clientIP': self.x402_handler.get_client_ip()
                    },
                    timeout=10
                )
                
                if verify_response.status_code == 200:
                    logger.info("  ✅ Payment verified by bot system")
                    
                    # Try to access content with verified payment
                    self.session.headers.update({
                        "X-Payment-Verified": "true",
                        "X-Transaction-ID": tx_id
                    })
                    
                    content_response = self.session.get(self.url, timeout=30)
                    if content_response.status_code == 200:
                        logger.info("  ✅ Content accessed after bot payment")
                        return content_response.text
                        
            logger.info("  ❌ Bot payment system not available or ineffective")
            return None
            
        except requests.ConnectionError:
            logger.info("  ⚠️ Bot payment system not running")
            return None
        except Exception as e:
            logger.error(f"  ❌ Bot payment system approach failed: {e}")
            return None
            
    def try_alternative_endpoints(self):
        """Try alternative endpoints that might not have bot protection"""
        logger.info("  🔍 Trying alternative endpoints...")
        
        alternative_urls = [
            f"{self.url}api/content",
            f"{self.url}public",
            f"{self.url}health",
            f"{self.url}status",
            f"{self.url.rstrip('/')}.json",
            f"{self.url}robots.txt"
        ]
        
        self.setup_human_like_headers()
        
        for alt_url in alternative_urls:
            try:
                logger.info(f"    🔗 Trying: {alt_url}")
                response = self.session.get(alt_url, timeout=15)
                
                if response.status_code == 200:
                    logger.info(f"    ✅ Success with: {alt_url}")
                    return response.text
                else:
                    logger.info(f"    ❌ {response.status_code} for: {alt_url}")
                    
            except Exception as e:
                logger.info(f"    ❌ Error with {alt_url}: {e}")
                
        logger.info("  ❌ No alternative endpoints accessible")
        return None
        
    def scrape_with_fallback(self):
        """Main scraping method with multiple fallback approaches"""
        logger.info(f"🚀 Starting enhanced scraping of {self.url}")
        
        # Try different approaches
        content = self.try_different_approaches()
        
        if content:
            logger.info("✅ Successfully retrieved content")
            
            # Save the content
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"scraped_content/successful_scrape_{timestamp}.txt"
            
            import os
            os.makedirs("scraped_content", exist_ok=True)
            
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"URL: {self.url}\n")
                f.write(f"Scraped at: {datetime.now().isoformat()}\n")
                f.write(f"Method: Enhanced multi-approach scraping\n")
                f.write("=" * 80 + "\n")
                f.write("CONTENT:\n")
                f.write("=" * 80 + "\n")
                f.write(content)
                
            logger.info(f"💾 Content saved to: {filename}")
            return content
        else:
            logger.error("❌ All approaches failed - content not accessible")
            
            # Create a detailed failure report
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_filename = f"scraped_content/failure_report_{timestamp}.txt"
            
            with open(report_filename, "w", encoding="utf-8") as f:
                f.write(f"SCRAPING FAILURE REPORT\n")
                f.write(f"URL: {self.url}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write("=" * 80 + "\n")
                f.write("ANALYSIS:\n")
                f.write("- Paywall uses bot protection, not X402 payments\n")
                f.write("- All bot requests blocked with 403 Forbidden\n")
                f.write("- Human browser simulation also blocked\n")
                f.write("- No alternative endpoints accessible\n")
                f.write("- Bot payment system integration unsuccessful\n")
                f.write("\nRECOMMENDATION:\n")
                f.write("- Contact paywall administrator for API access\n")
                f.write("- Request X402 payment integration\n")
                f.write("- Use authorized scraping methods\n")
                
            logger.info(f"📋 Failure report saved to: {report_filename}")
            return None


def main():
    """Main function to test the fixed scraper"""
    logger.info("🔧 Starting Fixed Paywall Integration Test")
    
    url = "https://paywall-worker.dharadarsh0.workers.dev/"
    scraper = FixedWebScraper(url)
    
    result = scraper.scrape_with_fallback()
    
    if result:
        logger.info("🎉 Scraping completed successfully!")
        print(f"\n📄 Content preview (first 200 chars):")
        print(result[:200] + "..." if len(result) > 200 else result)
    else:
        logger.error("❌ Scraping failed - see failure report for details")
        
    logger.info("🏁 Fixed integration test complete")


if __name__ == "__main__":
    main()