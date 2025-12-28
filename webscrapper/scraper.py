#!/usr/bin/env python3
"""
Bot-Paywall Simple Bot Scraper - x402 Payment Flow
========================================================
Example scraper using the BotPaywall SDK.

USAGE:
    python scraper.py --project example.com
    python scraper.py --list-projects
"""

import argparse
import sys
import time
import os
import requests

# Load environment variables from .env file
from pathlib import Path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value

# Import from the SDK
from botpaywall import BotPaywallClient, BotPaywallConfig, log


# =============================================================================
# CONFIGURATION (can be overridden by SDK)
# =============================================================================

CONFIG = {
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    'access_server_url': 'http://localhost:5000',
    'main_app_url': 'http://localhost:3000',
    'max_retries': 3,
    'wait_after_payment': 10,
    'retry_delay': 5
}

BOT_HEADERS = {
    'User-Agent': 'BotPaywall-Scraper/1.0 python-requests',
    'Accept': 'application/json',
}


# =============================================================================
# SCRAPING LOGIC (NOT part of SDK - this is YOUR custom logic)
# =============================================================================

def scrape(url, auth_headers=None):
    """
    Attempt to scrape the URL with optional auth headers.
    Returns (success, content, status_code).

    THIS IS YOUR CUSTOM SCRAPING LOGIC - customize as needed!
    """
    try:
        log(f"Scraping: {url}", "SCRAPE")

        headers = BOT_HEADERS.copy()
        if auth_headers:
            headers.update(auth_headers)
            log("Attached authentication headers", "LOCK")

        response = requests.get(url, headers=headers, timeout=30)

        log(f"Status: {response.status_code}", "INFO")

        if response.status_code == 200:
            log(f"Success! Got {len(response.text)} characters", "SUCCESS")
            return True, response.text, 200
        elif response.status_code == 402:
            log("Payment required (402)", "PAYMENT")
            try:
                payment_info = response.json()
                return False, payment_info, 402
            except:
                return False, None, 402
        else:
            log(f"Failed with status {response.status_code}", "ERROR")
            return False, None, response.status_code

    except Exception as e:
        log(f"Error: {e}", "ERROR")
        return False, None, 0


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Bot Scraper using BotPaywall SDK',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--url', '-u', type=str, help='Direct URL to scrape')
    parser.add_argument('--project', '-p', type=str, help='Project domain or identifier')
    parser.add_argument('--list-projects', '-l', action='store_true', help='List projects')
    parser.add_argument('--access-server', '-a', type=str, default=CONFIG['access_server_url'])
    parser.add_argument('--main-app', '-m', type=str, default=CONFIG['main_app_url'])
    parser.add_argument('--private-key', '-k', type=str, help='Private key for payments')
    parser.add_argument('--wait-time', '-w', type=int, default=CONFIG['wait_after_payment'])
    parser.add_argument('--max-retries', '-r', type=int, default=CONFIG['max_retries'])
    return parser.parse_args()


def main():
    """Main scraping flow using BotPaywall SDK."""
    args = parse_arguments()

    # Get private key from args or environment
    private_key = args.private_key or os.environ.get('WALLET_PRIVATE_KEY')

    if not private_key:
        log("ERROR: Private key not provided. Set WALLET_PRIVATE_KEY in .env or use --private-key", "ERROR")
        return 1

    # Initialize SDK client
    client = BotPaywallClient(
        access_server_url=args.access_server,
        main_app_url=args.main_app,
        private_key=private_key,

        wait_after_payment=args.wait_time,
        max_retries=args.max_retries,
    )

    # Handle --list-projects
    if args.list_projects:
        client.list_projects()
        return 0

    # Determine target URL and credentials
    target_url = CONFIG['target_url']
    zone_id = None
    secret_key = None

    if args.url:
        target_url = args.url if args.url.startswith('http') else f'https://{args.url}'
    elif args.project:
        project = client.get_project_credentials(args.project)
        if project:
            target_url = project['url']
            zone_id = project['zone_id']
            secret_key = project['secret_key']
            log(f"Resolved Project: {target_url}", "INFO")
        else:
            log(f"Could not resolve project: {args.project}", "ERROR")
            return 1

    print("\nSIMPLE BOT SCRAPER - Using BotPaywall SDK")
    print("=" * 80)
    print(f"Target: {target_url}")
    print("-" * 80)

    # Extract domain
    from botpaywall.utils import extract_domain_from_url
    target_domain = extract_domain_from_url(target_url)
    if not target_domain:
        log("Could not extract domain from target URL", "ERROR")
        return 1

    # Buy access using SDK
    print("\nPurchasing access...")
    result = client.buy_access(
        domain=target_domain,
        zone_id=zone_id,
        secret_key=secret_key
    )

    if not result['success']:
        log(f"Access not granted: {result.get('error')}", "ERROR")
        return 1

    # Wait for propagation
    client.wait_for_propagation()

    # Scrape with custom logic
    print("\nScraping website...")
    for attempt in range(1, args.max_retries + 1):
        log(f"Attempt {attempt}/{args.max_retries}", "INFO")

        success, content, status = scrape(target_url)

        if success:
            print("\n" + "=" * 80)
            print("SUCCESS!")
            print("=" * 80)

            with open('scraped_content.html', 'w', encoding='utf-8') as f:
                f.write(content)
            log("Saved to scraped_content.html", "SAVE")

            print(f"\nContent preview (first 300 chars):\n{'-'*40}")
            print(content[:300])
            return 0

        if attempt < args.max_retries:
            log(f"Retrying in {CONFIG['retry_delay']} seconds...", "WAIT")
            time.sleep(CONFIG['retry_delay'])

    log("Failed after all retries!", "ERROR")
    return 1


if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        log("Interrupted by user", "INFO")
        exit(1)
