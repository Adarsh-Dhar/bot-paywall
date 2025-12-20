#!/usr/bin/env python3
"""
Enhanced Web Scraper with X402 Payment Support and Bot Protection Bypass
Combines both X402 payment handling and smart bot detection bypass
"""

import os
import time
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from typing import Optional
from x402_payment_handler import X402PaymentHandler

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('enhanced_webscrapper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TARGET_URL = os.getenv("TARGET_URL", "https://paywall-worker.dharadarsh0.workers.dev/")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY = int(os.getenv("RETRY_DELAY", "1"))
BOT_PAYMENT_SYSTEM_URL = os.getenv("BOT_PAYMENT_SYSTEM_URL", "http://localhost:3000/api/x402-payment")


class EnhancedWebScraper:
    def __init__(self, url: str):
        self.url = url
        self.session = requests.Session()
        self.x402_handler = X402PaymentHandler(bot_payment_system_url=BOT_PAYMENT_SYSTEM_URL)
        self.success_method = None
        
    def setup_human_headers(self):
        """Setup realistic human browser headers"""
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
        
    def setup_bot_headers(self):
        """Setup bot headers for X402 payment flow"""
        self.session.headers.clear()
        self.session.headers.update({
            "User-Agent": "Python-WebScraper/1.0 (Bot)"
        })

    def fetch_with_human_simulation(self) -> Optional[str]:
        """Try to fetch content using human browser simulation"""
        logger.info("🌐 Attempting human browser simulation...")
        
        try:
            # Reset session and setup human headers
            self.session = requests.Session()
            self.setup_human_headers()
            
            # Add human-like delay
            time.sleep(2)
            
            response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
            logger.info(f"📡 Human simulation response: {response.status_code}")
            
            if response.status_code == 200:
                logger.info("✅ Success with human browser simulation")
                self.success_method = "Human Browser Simulation"
                return response.text
            elif response.status_code == 403:
                logger.info("❌ Still blocked with human headers")
                return None
            else:
                logger.info(f"⚠️ Unexpected status with human headers: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Human simulation failed: {e}")
            return None

    def fetch_with_x402_payment(self) -> Optional[str]:
        """Try to fetch content using X402 payment flow"""
        logger.info("💳 Attempting X402 payment flow...")
        
        try:
            # Reset session and setup bot headers for X402
            self.session = requests.Session()
            self.setup_bot_headers()
            
            response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
            logger.info(f"📡 X402 attempt response: {response.status_code}")
            
            # Check if we need to handle payment
            client_ip = self.x402_handler.get_client_ip()
            
            if self.x402_handler.should_trigger_new_payment(response):
                if response.status_code == 402 and self.x402_handler.detect_payment_required(response):
                    logger.info("💳 X402 Payment Required detected")
                    payment_success = self.x402_handler.handle_payment_required(response, client_ip)
                else:
                    logger.info("⏰ Handling as expired whitelist")
                    payment_success = self.x402_handler.handle_expired_whitelist(response, client_ip)
                
                if payment_success:
                    logger.info("🔄 Retrying request after successful payment...")
                    retry_response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
                    
                    if retry_response.status_code == 200:
                        logger.info("✅ Success with X402 payment flow")
                        self.success_method = "X402 Payment Flow"
                        return retry_response.text
                    else:
                        logger.info(f"❌ X402 payment didn't grant access: {retry_response.status_code}")
                        return None
                else:
                    logger.error("❌ X402 payment failed")
                    return None
            elif response.status_code == 200:
                logger.info("✅ Success without payment required")
                self.success_method = "Direct Access"
                return response.text
            else:
                logger.info(f"❌ X402 flow unsuccessful: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ X402 payment flow failed: {e}")
            return None

    def fetch_with_hybrid_approach(self) -> Optional[str]:
        """Try hybrid approach: X402 payment with human headers"""
        logger.info("🔄 Attempting hybrid approach (X402 + Human headers)...")
        
        try:
            # Start with bot headers to trigger X402 if needed
            self.session = requests.Session()
            self.setup_bot_headers()
            
            initial_response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
            
            # If X402 payment is required, handle it
            if self.x402_handler.should_trigger_new_payment(initial_response):
                client_ip = self.x402_handler.get_client_ip()
                
                if initial_response.status_code == 402 and self.x402_handler.detect_payment_required(initial_response):
                    payment_success = self.x402_handler.handle_payment_required(initial_response, client_ip)
                else:
                    payment_success = self.x402_handler.handle_expired_whitelist(initial_response, client_ip)
                
                if payment_success:
                    # After successful payment, switch to human headers
                    logger.info("🔄 Switching to human headers after payment...")
                    self.setup_human_headers()
                    
                    # Add payment verification headers
                    self.session.headers.update({
                        "X-Payment-Verified": "true",
                        "X-Transaction-ID": self.x402_handler.last_transaction_id,
                        "X-Client-IP": client_ip
                    })
                    
                    time.sleep(2)  # Human-like delay
                    
                    retry_response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
                    
                    if retry_response.status_code == 200:
                        logger.info("✅ Success with hybrid approach")
                        self.success_method = "Hybrid (X402 + Human Headers)"
                        return retry_response.text
                        
            logger.info("❌ Hybrid approach unsuccessful")
            return None
            
        except Exception as e:
            logger.error(f"❌ Hybrid approach failed: {e}")
            return None

    def fetch(self) -> Optional[str]:
        """Fetch the webpage with multiple strategies"""
        strategies = [
            ("Human Browser Simulation", self.fetch_with_human_simulation),
            ("X402 Payment Flow", self.fetch_with_x402_payment),
            ("Hybrid Approach", self.fetch_with_hybrid_approach)
        ]
        
        for attempt in range(MAX_RETRIES):
            logger.info(f"🔄 Fetch attempt {attempt + 1}/{MAX_RETRIES}")
            
            for strategy_name, strategy_func in strategies:
                logger.info(f"  📋 Trying strategy: {strategy_name}")
                
                try:
                    result = strategy_func()
                    if result:
                        logger.info(f"✅ Success with strategy: {strategy_name}")
                        return result
                    else:
                        logger.info(f"❌ Strategy failed: {strategy_name}")
                        
                except Exception as e:
                    logger.error(f"❌ Strategy error {strategy_name}: {e}")
            
            if attempt < MAX_RETRIES - 1:
                logger.info(f"⏳ All strategies failed, retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
        
        logger.error("❌ All fetch strategies exhausted")
        return None

    def parse(self, html: str) -> dict:
        """Parse HTML and extract comprehensive data"""
        soup = BeautifulSoup(html, "html.parser")
        
        # Extract all text content
        text_content = soup.get_text(separator='\n', strip=True)
        
        # Extract structured data
        data = {
            "url": self.url,
            "timestamp": datetime.now().isoformat(),
            "success_method": self.success_method,
            "title": soup.title.string.strip() if soup.title else "No title",
            "meta_description": "",
            "headings": {
                "h1": [h.get_text().strip() for h in soup.find_all("h1")],
                "h2": [h.get_text().strip() for h in soup.find_all("h2")],
                "h3": [h.get_text().strip() for h in soup.find_all("h3")],
            },
            "paragraphs": [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()],
            "links": [{"text": a.get_text().strip(), "href": a.get("href")} for a in soup.find_all("a") if a.get("href")],
            "images": [{"alt": img.get("alt", ""), "src": img.get("src")} for img in soup.find_all("img")],
            "full_text_content": text_content,
            "raw_html": html
        }
        
        # Extract meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            data["meta_description"] = meta_desc.get("content", "")
        
        return data

    def scrape(self) -> Optional[dict]:
        """Scrape the website and return parsed data"""
        logger.info(f"🚀 Starting enhanced scrape of {self.url}")
        
        html = self.fetch()
        if html:
            data = self.parse(html)
            self.log_content(data)
            return data
        
        logger.error("❌ Failed to fetch HTML content")
        return None
    
    def log_content(self, data: dict) -> None:
        """Log the scraped content in detail"""
        logger.info("=" * 80)
        logger.info("ENHANCED SCRAPING RESULTS")
        logger.info("=" * 80)
        logger.info(f"URL: {data['url']}")
        logger.info(f"Title: {data['title']}")
        logger.info(f"Success Method: {data['success_method']}")
        logger.info(f"Meta Description: {data['meta_description']}")
        logger.info(f"Timestamp: {data['timestamp']}")
        
        logger.info("\n" + "=" * 40)
        logger.info("CONTENT SUMMARY")
        logger.info("=" * 40)
        logger.info(f"H1 headings: {len(data['headings']['h1'])}")
        logger.info(f"H2 headings: {len(data['headings']['h2'])}")
        logger.info(f"H3 headings: {len(data['headings']['h3'])}")
        logger.info(f"Paragraphs: {len(data['paragraphs'])}")
        logger.info(f"Links: {len(data['links'])}")
        logger.info(f"Images: {len(data['images'])}")
        logger.info(f"Total text length: {len(data['full_text_content'])} characters")
        
        logger.info("\n" + "=" * 40)
        logger.info("CONTENT PREVIEW")
        logger.info("=" * 40)
        logger.info("First 300 characters:")
        logger.info(data['full_text_content'][:300] + "..." if len(data['full_text_content']) > 300 else data['full_text_content'])
        
        logger.info("\n" + "=" * 80)
        logger.info("END OF ENHANCED SCRAPING RESULTS")
        logger.info("=" * 80)


if __name__ == "__main__":
    logger.info("🚀 Starting Enhanced WebScraper Application")
    scraper = EnhancedWebScraper(TARGET_URL)
    data = scraper.scrape()
    
    if data:
        print("\n🎉 Enhanced scraping completed successfully!")
        print(f"Success Method: {data['success_method']}")
        print(f"Title: {data['title']}")
        print(f"H1 headings: {len(data['headings']['h1'])}")
        print(f"H2 headings: {len(data['headings']['h2'])}")
        print(f"H3 headings: {len(data['headings']['h3'])}")
        print(f"Paragraphs: {len(data['paragraphs'])}")
        print(f"Links found: {len(data['links'])}")
        print(f"Images found: {len(data['images'])}")
        print(f"Total text content: {len(data['full_text_content'])} characters")
        print(f"\nDetailed content has been logged to 'enhanced_webscrapper.log'")
        
        # Save content to organized folder
        os.makedirs("scraped_content", exist_ok=True)
        filename = f"scraped_content/enhanced_scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        with open(filename, "w", encoding="utf-8") as f:
            f.write(f"URL: {data['url']}\n")
            f.write(f"Title: {data['title']}\n")
            f.write(f"Success Method: {data['success_method']}\n")
            f.write(f"Scraped at: {data['timestamp']}\n")
            f.write("=" * 80 + "\n")
            f.write("FULL TEXT CONTENT:\n")
            f.write("=" * 80 + "\n")
            f.write(data['full_text_content'])
        
        print(f"Enhanced content saved to: {filename}")
    else:
        logger.error("❌ Enhanced scraping failed.")
        print("❌ Failed to scrape the website with all available methods.")