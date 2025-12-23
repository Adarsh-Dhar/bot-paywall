#!/usr/bin/env python3
"""
Enhanced webscraper that handles Cloudflare protection and logs all responses.
This scraper will show what we receive even if it's a challenge page.
"""

import requests
from datetime import datetime
import sys
import json

def scrape_website(url):
    """
    Scrape the given URL and return detailed response information.
    
    Args:
        url (str): The URL to scrape
        
    Returns:
        dict: Response details including status, headers, and content
    """
    try:
        print(f"[{datetime.now()}] Starting to scrape: {url}")
        
        # Enhanced headers to better mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        }
        
        # Make the request with session for cookie handling
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        
        result = {
            'url': url,
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'content': response.text,
            'content_length': len(response.text),
            'cookies': dict(response.cookies),
            'final_url': response.url,
            'history': [r.status_code for r in response.history]
        }
        
        print(f"[{datetime.now()}] Response status code: {response.status_code}")
        print(f"[{datetime.now()}] Final URL: {response.url}")
        print(f"[{datetime.now()}] Content length: {len(response.text)} characters")
        
        # Check for Cloudflare challenge
        if 'cf-mitigated' in response.headers:
            print(f"[{datetime.now()}] Cloudflare challenge detected!")
            print(f"[{datetime.now()}] Challenge type: {response.headers.get('cf-mitigated', 'unknown')}")
        
        return result
            
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] Error occurred while scraping: {e}")
        return None

def save_response_details(result, filename_prefix="scrape_result"):
    """Save detailed response information to files."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save HTML content
    html_filename = f"{filename_prefix}_{timestamp}.html"
    try:
        with open(html_filename, 'w', encoding='utf-8') as f:
            f.write(result['content'])
        print(f"[{datetime.now()}] HTML content saved to: {html_filename}")
    except Exception as e:
        print(f"[{datetime.now()}] Failed to save HTML: {e}")
    
    # Save response metadata
    json_filename = f"{filename_prefix}_{timestamp}_metadata.json"
    try:
        metadata = {k: v for k, v in result.items() if k != 'content'}
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        print(f"[{datetime.now()}] Metadata saved to: {json_filename}")
    except Exception as e:
        print(f"[{datetime.now()}] Failed to save metadata: {e}")

def main():
    """Main function to run the enhanced scraper."""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("=" * 80)
    print("ENHANCED WEBSCRAPER")
    print("=" * 80)
    
    # Scrape the website
    result = scrape_website(url)
    
    if result:
        print("\n" + "=" * 80)
        print("RESPONSE DETAILS:")
        print("=" * 80)
        print(f"Status Code: {result['status_code']}")
        print(f"Final URL: {result['final_url']}")
        print(f"Content Length: {result['content_length']}")
        print(f"Redirects: {result['history']}")
        
        print("\nHeaders:")
        for key, value in result['headers'].items():
            print(f"  {key}: {value}")
        
        print("\nCookies:")
        for key, value in result['cookies'].items():
            print(f"  {key}: {value}")
        
        print("\n" + "=" * 80)
        print("CONTENT PREVIEW (first 1000 characters):")
        print("=" * 80)
        print(result['content'][:1000])
        if len(result['content']) > 1000:
            print("... [content truncated] ...")
        
        print("\n" + "=" * 80)
        print("FULL CONTENT:")
        print("=" * 80)
        print(result['content'])
        
        # Save to files
        save_response_details(result)
        
        # Analysis
        print("\n" + "=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        
        if result['status_code'] == 403:
            print("❌ Access denied (403) - likely Cloudflare bot protection")
        elif result['status_code'] == 200:
            print("✅ Success! Content retrieved")
        else:
            print(f"⚠️  Unexpected status code: {result['status_code']}")
        
        if 'cloudflare' in result['headers'].get('server', '').lower():
            print("🛡️  Cloudflare detected in server header")
        
        if 'challenge' in result['content'].lower():
            print("🔒 Challenge page detected in content")
        
    else:
        print("❌ Failed to scrape the website.")
        sys.exit(1)

if __name__ == "__main__":
    main()