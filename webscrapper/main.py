import os
import time
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from typing import Optional

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('webscrapper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TARGET_URL = os.getenv("TARGET_URL", "https://example.com")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY = int(os.getenv("RETRY_DELAY", "1"))


class WebScraper:
    def __init__(self, url: str):
        self.url = url
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Python-WebScraper/1.0 (Bot)"
        })

    def fetch(self) -> Optional[str]:
        """Fetch the webpage with retry logic."""
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(f"Fetching {self.url} (attempt {attempt + 1}/{MAX_RETRIES})...")
                response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
                logger.info(f"✅ Successfully fetched: {response.status_code}")
                logger.info(f"Content length: {len(response.text)} characters")
                return response.text
            except requests.RequestException as e:
                logger.error(f"❌ Error: {e}")
                if attempt < MAX_RETRIES - 1:
                    logger.info(f"⏳ Retrying in {RETRY_DELAY} seconds...")
                    time.sleep(RETRY_DELAY)
        return None

    def parse(self, html: str) -> dict:
        """Parse HTML and extract comprehensive data."""
        soup = BeautifulSoup(html, "html.parser")
        
        # Extract all text content
        text_content = soup.get_text(separator='\n', strip=True)
        
        # Extract structured data
        data = {
            "url": self.url,
            "timestamp": datetime.now().isoformat(),
            "title": soup.title.string.strip() if soup.title else "No title",
            "meta_description": "",
            "headings": {
                "h1": [h.get_text().strip() for h in soup.find_all("h1")],
                "h2": [h.get_text().strip() for h in soup.find_all("h2")],
                "h3": [h.get_text().strip() for h in soup.find_all("h3")],
            },
            "paragraphs": [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()],
            "links": [{"text": a.get_text().strip(), "href": a.get("href")} for a in soup.find_all("a") if a.get("href")],
            "images": [{"alt": img.get("alt", ""), "src": img.get("src")} for img in soup.find_all("img")],
            "full_text_content": text_content,
            "raw_html": html
        }
        
        # Extract meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            data["meta_description"] = meta_desc.get("content", "")
        
        return data

    def scrape(self) -> Optional[dict]:
        """Scrape the website and return parsed data."""
        logger.info(f"Starting scrape of {self.url}")
        html = self.fetch()
        if html:
            data = self.parse(html)
            self.log_content(data)
            return data
        logger.error("Failed to fetch HTML content")
        return None
    
    def log_content(self, data: dict) -> None:
        """Log the scraped content in detail."""
        logger.info("=" * 80)
        logger.info("PAGE CONTENT SUMMARY")
        logger.info("=" * 80)
        logger.info(f"URL: {data['url']}")
        logger.info(f"Title: {data['title']}")
        logger.info(f"Meta Description: {data['meta_description']}")
        logger.info(f"Timestamp: {data['timestamp']}")
        
        logger.info("\n" + "=" * 40)
        logger.info("HEADINGS")
        logger.info("=" * 40)
        for level, headings in data['headings'].items():
            if headings:
                logger.info(f"{level.upper()}: {len(headings)} found")
                for i, heading in enumerate(headings[:5], 1):  # Show first 5
                    logger.info(f"  {i}. {heading}")
                if len(headings) > 5:
                    logger.info(f"  ... and {len(headings) - 5} more")
        
        logger.info("\n" + "=" * 40)
        logger.info("PARAGRAPHS")
        logger.info("=" * 40)
        logger.info(f"Total paragraphs: {len(data['paragraphs'])}")
        for i, paragraph in enumerate(data['paragraphs'][:3], 1):  # Show first 3
            logger.info(f"  {i}. {paragraph[:100]}{'...' if len(paragraph) > 100 else ''}")
        if len(data['paragraphs']) > 3:
            logger.info(f"  ... and {len(data['paragraphs']) - 3} more paragraphs")
        
        logger.info("\n" + "=" * 40)
        logger.info("LINKS")
        logger.info("=" * 40)
        logger.info(f"Total links: {len(data['links'])}")
        for i, link in enumerate(data['links'][:5], 1):  # Show first 5
            logger.info(f"  {i}. {link['text'][:50]}{'...' if len(link['text']) > 50 else ''} -> {link['href']}")
        if len(data['links']) > 5:
            logger.info(f"  ... and {len(data['links']) - 5} more links")
        
        logger.info("\n" + "=" * 40)
        logger.info("IMAGES")
        logger.info("=" * 40)
        logger.info(f"Total images: {len(data['images'])}")
        for i, img in enumerate(data['images'][:5], 1):  # Show first 5
            logger.info(f"  {i}. Alt: '{img['alt']}' Src: {img['src']}")
        if len(data['images']) > 5:
            logger.info(f"  ... and {len(data['images']) - 5} more images")
        
        logger.info("\n" + "=" * 40)
        logger.info("FULL TEXT CONTENT")
        logger.info("=" * 40)
        logger.info(f"Total text length: {len(data['full_text_content'])} characters")
        logger.info("First 500 characters:")
        logger.info(data['full_text_content'][:500] + "..." if len(data['full_text_content']) > 500 else data['full_text_content'])
        
        logger.info("\n" + "=" * 80)
        logger.info("END OF PAGE CONTENT")
        logger.info("=" * 80)


if __name__ == "__main__":
    logger.info("Starting WebScraper application")
    scraper = WebScraper(TARGET_URL)
    data = scraper.scrape()
    
    if data:
        print("\n📄 Scraping completed successfully!")
        print(f"Title: {data['title']}")
        print(f"H1 headings: {len(data['headings']['h1'])}")
        print(f"H2 headings: {len(data['headings']['h2'])}")
        print(f"H3 headings: {len(data['headings']['h3'])}")
        print(f"Paragraphs: {len(data['paragraphs'])}")
        print(f"Links found: {len(data['links'])}")
        print(f"Images found: {len(data['images'])}")
        print(f"Total text content: {len(data['full_text_content'])} characters")
        print(f"\nDetailed content has been logged to 'webscrapper.log'")
        
        # Also save full content to a separate file
        with open(f"scraped_content_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt", "w", encoding="utf-8") as f:
            f.write(f"URL: {data['url']}\n")
            f.write(f"Title: {data['title']}\n")
            f.write(f"Scraped at: {data['timestamp']}\n")
            f.write("=" * 80 + "\n")
            f.write("FULL TEXT CONTENT:\n")
            f.write("=" * 80 + "\n")
            f.write(data['full_text_content'])
        
        print(f"Full text content saved to: scraped_content_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
    else:
        logger.error("Failed to scrape the website.")
        print("❌ Failed to scrape the website.")
