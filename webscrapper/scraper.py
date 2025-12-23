#!/usr/bin/env python3
"""
Simple webscraper that scrapes https://test-cloudflare-website.adarsh.software/
and logs the entire page content.
"""

import requests
from datetime import datetime
import sys

def scrape_website(url):
    """
    Scrape the given URL and log the entire page content.
    
    Args:
        url (str): The URL to scrape
        
    Returns:
        str: The page content or None if failed
    """
    try:
        print(f"[{datetime.now()}] Starting to scrape: {url}")
        
        # Set headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # Make the request
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"[{datetime.now()}] Response status code: {response.status_code}")
        print(f"[{datetime.now()}] Response headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        
        # Check if we got blocked by Cloudflare
        if "Just a moment..." in response.text or "cf-mitigated: challenge" in str(response.headers):
            print(f"\n[{datetime.now()}] ❌ BLOCKED BY CLOUDFLARE!")
            print("🛡️ Cloudflare bot protection is active")
            print("🤖 This request was detected as a bot and blocked")
            print("📄 Received Cloudflare challenge page instead of actual content")
            print("\nTo bypass this, you would need:")
            print("- Browser automation (Selenium)")
            print("- IP whitelisting through Cloudflare API")
            print("- Or use the automated scraper in simple-webscrapper/")
            return None
        
        # Log the entire page content
        print(f"\n[{datetime.now()}] FULL PAGE CONTENT:")
        print("=" * 80)
        print(response.text)
        print("=" * 80)
        print(f"Content length: {len(response.text)} characters")
        
        return response.text
            
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] Error occurred while scraping: {e}")
        return None

def main():
    """Main function to run the scraper."""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("Simple Webscraper")
    print("Target URL:", url)
    print("-" * 50)
    
    # Scrape the website
    content = scrape_website(url)
    
    if content:
        print(f"\n[{datetime.now()}] Scraping completed successfully!")
    else:
        print(f"\n[{datetime.now()}] Scraping failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()