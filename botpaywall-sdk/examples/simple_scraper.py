#!/usr/bin/env python3
"""
Example: Simple scraper using BotPaywall SDK

This example demonstrates how to build a custom scraper using the SDK.
The SDK handles all the payment and whitelisting logic.
"""

import argparse
import requests
from botpaywall import BotPaywallClient, log


def main():
    parser = argparse.ArgumentParser(description='Simple scraper using BotPaywall SDK')
    parser.add_argument('--domain', '-d', required=True, help='Domain to scrape')
    parser.add_argument('--private-key', '-k', required=True, help='Private key for payments')
    parser.add_argument('--access-server', default=process.env.ACCESS_SERVER_URL)
    parser.add_argument('--main-app', default=process.env.MAIN_APP_API_URL)
    parser.add_argument('--output', '-o', default='output.html', help='Output file')
    args = parser.parse_args()

    # Initialize the SDK client
    client = BotPaywallClient(
        access_server_url=args.access_server,
        main_app_url=args.main_app,
        private_key=args.private_key
    )

    # Step 1: Get project credentials
    log(f"Getting credentials for {args.domain}...", "INFO")
    project = client.get_project_credentials(args.domain)

    if not project:
        log("Failed to get project credentials", "ERROR")
        return 1

    target_url = project['url']
    log(f"Target URL: {target_url}", "INFO")

    # Step 2: Buy access
    log("Purchasing access...", "PAYMENT")
    result = client.buy_access(
        domain=args.domain,
        zone_id=project['zone_id'],
        secret_key=project['secret_key']
    )

    if not result['success']:
        log(f"Failed to buy access: {result.get('error')}", "ERROR")
        return 1

    # Step 3: Wait for propagation
    client.wait_for_propagation()

    # Step 4: YOUR CUSTOM SCRAPING LOGIC HERE
    log("Scraping website...", "SCRAPE")

    # Simple example - just fetch the page
    response = requests.get(target_url, timeout=30)

    if response.status_code == 200:
        log(f"Success! Got {len(response.text)} characters", "SUCCESS")

        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(response.text)
        log(f"Saved to {args.output}", "SAVE")

        return 0
    else:
        log(f"Failed to scrape: {response.status_code}", "ERROR")
        return 1


if __name__ == "__main__":
    exit(main())
