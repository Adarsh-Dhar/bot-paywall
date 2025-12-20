#!/usr/bin/env python3
"""
Enhanced Web Scraper with Cloudflare Challenge Bypass
Handles Cloudflare challenges, X402 payments, and bot protection
"""

import os
import time
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from typing import Optional
import json
import re

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cloudflare_bypass.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TARGET_URL = os.getenv("TARGET_URL", "https://test-cloudflare-website.adarsh.software/")


class CloudflareBypasser:
    """Handles Cloudflare challenges and various paywall types"""
    
    def __init__(self, url: str):
        self.url = url
        self.session = requests.Session()
        self.success_method = None
        
    def setup_realistic_browser_session(self):
        """Setup a realistic browser session with proper headers and behavior"""
        self.session = requests.Session()
        
        # Realistic browser headers
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"'
        })
        
    def detect_cloudflare_challenge(self, response):
        """Detect if response is a Cloudflare challenge"""
        # Check headers
        cf_mitigated = response.headers.get('cf-mitigated', '')
        if cf_mitigated == 'challenge':
            return True
            
        # Check content
        content = response.text.lower()
        cf_indicators = [
            'just a moment',
            'checking your browser',
            'cloudflare',
            'ray id',
            'cf-browser-verification'
        ]
        
        return any(indicator in content for indicator in cf_indicators)
    
    def extract_cloudflare_challenge_data(self, response):
        """Extract challenge data from Cloudflare page"""
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for challenge form
            challenge_form = soup.find('form', {'id': 'challenge-form'}) or soup.find('form')
            
            if challenge_form:
                action = challenge_form.get('action', '')
                method = challenge_form.get('method', 'POST').upper()
                
                # Extract form data
                form_data = {}
                for input_tag in challenge_form.find_all('input'):
                    name = input_tag.get('name')
                    value = input_tag.get('value', '')
                    if name:
                        form_data[name] = value
                
                return {
                    'action': action,
                    'method': method,
                    'form_data': form_data,
                    'challenge_detected': True
                }
            
            # Look for JavaScript challenge
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and ('challenge' in script.string.lower() or 'cf' in script.string.lower()):
                    return {
                        'challenge_detected': True,
                        'type': 'javascript',
                        'script_content': script.string[:200] + '...' if len(script.string) > 200 else script.string
                    }
            
            return {'challenge_detected': False}
            
        except Exception as e:
            logger.error(f"Error extracting challenge data: {e}")
            return {'challenge_detected': False}
    
    def wait_for_cloudflare_challenge(self, initial_response):
        """Wait for Cloudflare challenge to complete"""
        logger.info("⏳ Waiting for Cloudflare challenge to complete...")
        
        challenge_data = self.extract_cloudflare_challenge_data(initial_response)
        
        if not challenge_data.get('challenge_detected'):
            logger.info("❌ No Cloudflare challenge detected")
            return None
        
        logger.info("🔍 Cloudflare challenge detected")
        logger.info(f"Challenge type: {challenge_data.get('type', 'form-based')}")
        
        # Strategy 1: Wait and retry (for automatic challenges)
        logger.info("⏳ Waiting for automatic challenge completion...")
        
        for attempt in range(10):  # Wait up to 30 seconds
            time.sleep(3)
            
            try:
                # Retry the request
                retry_response = self.session.get(self.url, timeout=30)
                
                if not self.detect_cloudflare_challenge(retry_response):
                    logger.info(f"✅ Cloudflare challenge completed after {(attempt + 1) * 3} seconds")
                    return retry_response
                else:
                    logger.info(f"⏳ Still in challenge... attempt {attempt + 1}/10")
                    
            except Exception as e:
                logger.error(f"Error during challenge retry: {e}")
        
        logger.error("❌ Cloudflare challenge did not complete automatically")
        return None
    
    def try_cloudflare_bypass_techniques(self):
        """Try various Cloudflare bypass techniques"""
        logger.info("🔄 Trying Cloudflare bypass techniques...")
        
        techniques = [
            ("Realistic Browser Session", self.try_realistic_browser),
            ("Session Persistence", self.try_session_persistence),
            ("Header Rotation", self.try_header_rotation),
            ("Delayed Requests", self.try_delayed_requests)
        ]
        
        for technique_name, technique_func in techniques:
            logger.info(f"  📋 Trying: {technique_name}")
            
            try:
                result = technique_func()
                if result and not self.detect_cloudflare_challenge(result):
                    logger.info(f"✅ Success with: {technique_name}")
                    self.success_method = f"Cloudflare Bypass - {technique_name}"
                    return result
                else:
                    logger.info(f"❌ Failed: {technique_name}")
            except Exception as e:
                logger.error(f"❌ Error with {technique_name}: {e}")
        
        return None
    
    def try_realistic_browser(self):
        """Try with realistic browser simulation"""
        self.setup_realistic_browser_session()
        
        # Add some realistic behavior
        time.sleep(2)  # Human-like delay
        
        response = self.session.get(self.url, timeout=30)
        
        if self.detect_cloudflare_challenge(response):
            # Wait for challenge to complete
            return self.wait_for_cloudflare_challenge(response)
        
        return response
    
    def try_session_persistence(self):
        """Try with persistent session and cookies"""
        self.setup_realistic_browser_session()
        
        # Make a preliminary request to establish session
        try:
            prelim_response = self.session.get(self.url, timeout=30)
            
            if self.detect_cloudflare_challenge(prelim_response):
                # Wait for challenge
                final_response = self.wait_for_cloudflare_challenge(prelim_response)
                return final_response
            else:
                return prelim_response
                
        except Exception as e:
            logger.error(f"Session persistence failed: {e}")
            return None
    
    def try_header_rotation(self):
        """Try with different browser headers"""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ]
        
        for ua in user_agents:
            self.session = requests.Session()
            self.session.headers.update({
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            })
            
            try:
                response = self.session.get(self.url, timeout=30)
                
                if self.detect_cloudflare_challenge(response):
                    result = self.wait_for_cloudflare_challenge(response)
                    if result:
                        return result
                else:
                    return response
                    
            except Exception as e:
                logger.error(f"Header rotation attempt failed: {e}")
                continue
        
        return None
    
    def try_delayed_requests(self):
        """Try with human-like delays between requests"""
        self.setup_realistic_browser_session()
        
        # Simulate browsing behavior
        delays = [2, 3, 1, 4, 2]  # Random-ish delays
        
        for i, delay in enumerate(delays):
            logger.info(f"  ⏳ Attempt {i+1}/5 with {delay}s delay...")
            time.sleep(delay)
            
            try:
                response = self.session.get(self.url, timeout=30)
                
                if not self.detect_cloudflare_challenge(response):
                    return response
                elif i == 0:  # First attempt with challenge
                    result = self.wait_for_cloudflare_challenge(response)
                    if result:
                        return result
                        
            except Exception as e:
                logger.error(f"Delayed request attempt {i+1} failed: {e}")
        
        return None
    
    def scrape_with_cloudflare_bypass(self):
        """Main scraping method with Cloudflare bypass"""
        logger.info(f"🚀 Starting Cloudflare bypass scraping of {self.url}")
        
        # Try bypass techniques
        response = self.try_cloudflare_bypass_techniques()
        
        if response and response.status_code == 200:
            logger.info("✅ Successfully bypassed Cloudflare protection")
            
            # Parse content
            soup = BeautifulSoup(response.text, 'html.parser')
            text_content = soup.get_text(separator='\n', strip=True)
            
            data = {
                "url": self.url,
                "timestamp": datetime.now().isoformat(),
                "success_method": self.success_method,
                "title": soup.title.string.strip() if soup.title else "No title",
                "content_length": len(response.text),
                "text_content": text_content,
                "status_code": response.status_code
            }
            
            # Save content
            os.makedirs("scraped_content", exist_ok=True)
            filename = f"scraped_content/cloudflare_bypass_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"URL: {data['url']}\n")
                f.write(f"Title: {data['title']}\n")
                f.write(f"Success Method: {data['success_method']}\n")
                f.write(f"Scraped at: {data['timestamp']}\n")
                f.write(f"Status Code: {data['status_code']}\n")
                f.write("=" * 80 + "\n")
                f.write("CONTENT:\n")
                f.write("=" * 80 + "\n")
                f.write(text_content)
            
            logger.info(f"💾 Content saved to: {filename}")
            return data
            
        else:
            logger.error("❌ Failed to bypass Cloudflare protection")
            
            # Create failure report
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_filename = f"scraped_content/cloudflare_failure_{timestamp}.txt"
            
            with open(report_filename, "w", encoding="utf-8") as f:
                f.write(f"CLOUDFLARE BYPASS FAILURE REPORT\n")
                f.write(f"URL: {self.url}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write("=" * 80 + "\n")
                f.write("ANALYSIS:\n")
                f.write("- Cloudflare challenge detected\n")
                f.write("- All bypass techniques failed\n")
                f.write("- May require browser automation (Selenium/Playwright)\n")
                f.write("- Or manual challenge completion\n")
                f.write("\nRECOMMENDATIONS:\n")
                f.write("1. Use browser automation tools\n")
                f.write("2. Contact site administrator for API access\n")
                f.write("3. Use proxy services that handle Cloudflare\n")
                f.write("4. Wait and retry (challenges may be temporary)\n")
            
            logger.info(f"📋 Failure report saved to: {report_filename}")
            return None


def main():
    """Main function"""
    logger.info("🚀 Starting Cloudflare Bypass Scraper")
    
    scraper = CloudflareBypasser(TARGET_URL)
    result = scraper.scrape_with_cloudflare_bypass()
    
    if result:
        print("\n🎉 Cloudflare bypass successful!")
        print(f"Success Method: {result['success_method']}")
        print(f"Title: {result['title']}")
        print(f"Content Length: {result['content_length']} characters")
        print(f"Status Code: {result['status_code']}")
        print("\nContent preview (first 200 chars):")
        print(result['text_content'][:200] + "..." if len(result['text_content']) > 200 else result['text_content'])
    else:
        print("❌ Cloudflare bypass failed - see failure report for details")
    
    logger.info("🏁 Cloudflare bypass scraper complete")


if __name__ == "__main__":
    main()