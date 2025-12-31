#!/usr/bin/env python3
"""
Web Scraper - Main Entry Point
Scrapes website content from a URL provided via command line
Usage: python main.py <website-url>
"""

import sys
import argparse
from scraper import WebScraper
from utils import validate_url, save_to_file
import os
import logging
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
        type=str,
        help='The website URL to scrape'
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

    # Validate URL
    if not validate_url(args.url):
        logger.error(f"Invalid URL: {args.url}")
        sys.exit(1)

    private_key = os.environ.get('WALLET_PRIVATE_KEY')

    if not private_key:
        logger.error("Private key not provided. Set WALLET_PRIVATE_KEY in .env ")
        sys.exit(1)

        # Initialize SDK client with actual implementation
    client = BotPaywallClient(
        access_server_url=CONFIG['access_server_url'],
        main_app_url=CONFIG['main_app_url'],
        private_key=private_key,
        wait_after_payment=CONFIG['wait_after_payment'],
        max_retries=CONFIG['max_retries'],
    )


    try:
        logger.info(f"Checking paywall status for: {args.url}")
        # Extract domain from URL
        target_domain = extract_domain_from_url(args.url)
        if not target_domain:
            logger.error("Could not extract domain from URL")
            sys.exit(1)

        # Buy access using SDK
        result = client.buy_access(domain=target_domain)

        if not result['success']:
            logger.error(f"Access not granted: {result.get('error')}")
            sys.exit(1)

        # Wait for propagation
        client.wait_for_propagation()

        # Initialize scraper with optional access token
        logger.info(f"Starting to scrape: {args.url}") # end
        scraper = WebScraper(args.url)

        # Scrape the website
        data = scraper.scrape()

        if not data:
            logger.error("No data was scraped from the website")
            sys.exit(1)

        # Save results
        output_file = save_to_file(data, args.url, args.output, args.format)

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