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
    Scrape the given URL and return the page content.
    
    Args:
        url (str): The URL to scrape
        
    Returns:
        str: The page content or None if failed
    """
    try:
        print(f"[{datetime.now()}] Starting to scrape: {url}")
        
        # Set headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # Make the request
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"[{datetime.now()}] Response status code: {response.status_code}")
        print(f"[{datetime.now()}] Response headers: {dict(response.headers)}")
        
        # Check if request was successful
        if response.status_code == 200:
            print(f"[{datetime.now()}] Successfully scraped the website!")
            return response.text
        else:
            print(f"[{datetime.now()}] Failed to scrape. Status code: {response.status_code}")
            print(f"[{datetime.now()}] Response content: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] Error occurred while scraping: {e}")
        return None

def main():
    """Main function to run the scraper."""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("=" * 80)
    print("SIMPLE WEBSCRAPER")
    print("=" * 80)
    
    # Scrape the website
    content = scrape_website(url)
    
    if content:
        print("\n" + "=" * 80)
        print("SCRAPED CONTENT:")
        print("=" * 80)
        print(content)
        print("=" * 80)
        print(f"Content length: {len(content)} characters")
        
        # Optionally save to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"scraped_content_{timestamp}.html"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Content saved to: {filename}")
        except Exception as e:
            print(f"Failed to save content to file: {e}")
    else:
        print("Failed to scrape the website.")
        sys.exit(1)

if __name__ == "__main__":
    main()