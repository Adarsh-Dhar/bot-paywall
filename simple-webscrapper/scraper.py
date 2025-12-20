#!/usr/bin/env python3
"""
Simple webscraper that scrapes https://test-cloudflare-website.adarsh.software/
and logs the content.
"""

import requests
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def scrape_website():
    """Scrape the target website and log its content."""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    try:
        logger.info(f"Starting to scrape: {url}")
        
        # Make the request
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Log the content
        logger.info(f"Successfully scraped website. Status code: {response.status_code}")
        logger.info(f"Content length: {len(response.text)} characters")
        logger.info("Website content:")
        logger.info("-" * 50)
        logger.info(response.text)
        logger.info("-" * 50)
        
        return response.text
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping website: {e}")
        return None

if __name__ == "__main__":
    logger.info("Simple webscraper started")
    content = scrape_website()
    if content:
        logger.info("Scraping completed successfully")
    else:
        logger.error("Scraping failed")