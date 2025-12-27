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
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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

    try:
        # Initialize scraper
        logger.info(f"Starting to scrape: {args.url}")
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