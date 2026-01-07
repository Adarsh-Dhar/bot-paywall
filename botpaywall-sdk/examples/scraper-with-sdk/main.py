#!/usr/bin/env python3
"""
Web Scraper - Main Entry Point
Scrapes website content from a URL provided via command line
Usage: python main.py <website-url> --secret-key <project-secret-key>
"""

import sys
import argparse
from scraper import WebScraper
from utils import validate_url, save_to_file
import os
import logging
import requests
import time
from botpaywall import BotPaywallClient  #added
from botpaywall.utils import extract_domain_from_url  #added


# Load environment variables from .env file
from pathlib import Path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
CONFIG = {
    'access_server_url': "http://localhost:5000",
    'main_app_url': "http://localhost:3000",
    'max_retries': 3,
    # Wait for Cloudflare rule propagation
    'wait_after_payment': 10,
}

def main():
    """Main function to run the web scraper"""

    # Set up argument parser
    parser = argparse.ArgumentParser(
        description='Web Scraper - Extract content from any website',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python main.py https://example.com
  python main.py https://example.com --output results.json
  python main.py https://example.com --format txt
        '''
    )

    parser.add_argument(
        'url',
        nargs='?',
        default=None,
        type=str,
        help='The website URL to scrape. If omitted, the project website_url from secret key is used.'
    )

    parser.add_argument(
        '--secret-key', '-sk',
        type=str,
        required=True,
        help='Secret key to fetch project credentials from bot-paywall'
    )

    parser.add_argument(
        '--scraper-ip',
        type=str,
        default=None,
        help='Override the detected public IP to whitelist'
    )

    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help='Output file name (default: auto-generated based on domain)'
    )

    parser.add_argument(
        '--format', '-f',
        type=str,
        choices=['json', 'txt', 'html'],
        default='json',
        help='Output format (default: json)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )

    # Parse arguments
    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    private_key = os.environ.get('WALLET_PRIVATE_KEY')

    if not private_key:
        logger.error("Private key not provided. Set WALLET_PRIVATE_KEY in .env ")
        sys.exit(1)

    # Initialize SDK client with actual implementation
    client = BotPaywallClient(
        access_server_url=CONFIG['access_server_url'],
        main_app_url=CONFIG['main_app_url'],
        private_key=private_key,
        secret_key=args.secret_key,
        wait_after_payment=CONFIG['wait_after_payment'],
        max_retries=CONFIG['max_retries'],
    )

    if not client.project_details:
        logger.error("Could not fetch project details using the provided secret key")
        sys.exit(1)


    try:
        target_url = args.url or client.project_details.get('website_url') or client.project_details.get('websiteUrl')
        if not target_url:
            logger.error("No URL provided and project has no website_url")
            sys.exit(1)

        if not validate_url(target_url):
            logger.error(f"Invalid URL: {target_url}")
            sys.exit(1)

        logger.info(f"Checking paywall status for: {target_url}")
        # Extract domain from URL or project
        target_domain = extract_domain_from_url(target_url) or client.project_details.get('domain')
        if not target_domain:
            logger.error("Could not determine domain from URL")
            sys.exit(1)

        # Determine credentials
        zone_id = None
        secret_key_for_access = None

        if client.project_details:
            zone_id = client.project_details.get('zone_id') or client.project_details.get('zoneId')
            secret_key_for_access = (
                client.project_details.get('api_token')
                or client.project_details.get('secret_key')
                or client.project_details.get('secretKey')
            )
            logger.info("Using credentials from secret key lookup")
        else:
            credentials = client.get_project_credentials(target_domain)
            if credentials:
                zone_id = credentials.get('zone_id')
                secret_key_for_access = credentials.get('secret_key')
                logger.info("Using credentials from domain lookup")

        # Detect scraper egress IP (actual IP used by requests); allow manual override if provided
        def detect_ip() -> str:
            return requests.get('https://api.ipify.org', timeout=5).text.strip()

        try:
            detected_ip = args.scraper_ip.strip() if args.scraper_ip else detect_ip()
        except Exception as e:
            logger.error(f"Could not determine scraper IP: {e}")
            sys.exit(1)

        logger.info("Detected scraper egress IP")

        # Whitelist the detected IP
        result = client.buy_access(
            domain=target_domain,
            zone_id=zone_id,
            secret_key=secret_key_for_access,
            scraper_ip=detected_ip
        )

        if not result['success']:
            logger.error(f"Access not granted for {detected_ip}: {result.get('error')}")
            sys.exit(1)

        # Wait for propagation
        client.wait_for_propagation()

        # Confirm whitelist before scraping; retry a few times
        for attempt in range(8):
            try:
                is_whitelisted = client.check_access_status(detected_ip, target_domain)
                if is_whitelisted:
                    break
                time.sleep(5)
            except Exception:
                time.sleep(5)

        # Final IP check just before scraping; if new IP appears, whitelist it once more
        try:
            current_ip = detect_ip()
            if current_ip and current_ip != detected_ip:
                logger.warning("Egress IP changed; whitelisting it...")
                result = client.buy_access(
                    domain=target_domain,
                    zone_id=zone_id,
                    secret_key=secret_key_for_access,
                    scraper_ip=current_ip
                )
                if not result['success']:
                    logger.error(f"Access not granted after IP change: {result.get('error')}")
                    sys.exit(1)
                client.wait_for_propagation()

                # Confirm whitelist after change
                for attempt in range(8):
                    try:
                        is_whitelisted = client.check_access_status(current_ip, target_domain)
                        if is_whitelisted:
                            break
                        time.sleep(5)
                    except Exception:
                        time.sleep(5)

                detected_ip = current_ip
            else:
                # If IP unchanged, still ensure whitelist is active before scraping
                for attempt in range(8):
                    try:
                        is_whitelisted = client.check_access_status(detected_ip, target_domain)
                        if is_whitelisted:
                            break
                        time.sleep(5)
                    except Exception:
                        time.sleep(5)
        except Exception as e:
            logger.warning(f"Could not re-check egress IP: {e}")

        # Initialize scraper with Cloudflare credentials
        logger.info(f"Starting to scrape: {target_url}")
        scraper = WebScraper(target_url, zone_id=zone_id, secret_key=secret_key_for_access)

        # Scrape the website
        data = scraper.scrape()

        if not data:
            logger.error("No data was scraped from the website")
            sys.exit(1)

        # Save results
        output_file = save_to_file(data, target_url, args.output, args.format)

        logger.info(f"Successfully scraped {args.url}")
        logger.info(f"Results saved to: {output_file}")

        # Print summary
        print("\n" + "="*50)
        print("SCRAPING SUMMARY")
        print("="*50)
        print(f"URL: {data.get('url', 'N/A')}")
        print(f"Title: {data.get('title', 'N/A')}")
        print(f"Text Length: {len(data.get('text', ''))} characters")
        print(f"Links Found: {len(data.get('links', []))}")
        print(f"Images Found: {len(data.get('images', []))}")
        print(f"Output File: {output_file}")
        print("="*50)

    except KeyboardInterrupt:
        logger.warning("\nScraping interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"An error occurred: {str(e)}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()