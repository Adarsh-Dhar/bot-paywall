import os
import time
import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from typing import Optional

load_dotenv()

TARGET_URL = os.getenv("TARGET_URL", "https://example.com")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY = int(os.getenv("RETRY_DELAY", "1"))


class WebScraper:
    def __init__(self, url: str, password: str):
        self.url = url
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "X-Access-Password": password
        })

    def fetch(self) -> Optional[str]:
        """Fetch the webpage with password authentication and retry logic."""
        for attempt in range(MAX_RETRIES):
            try:
                print(f"Fetching {self.url} (attempt {attempt + 1}/{MAX_RETRIES})...")
                response = self.session.get(self.url, timeout=REQUEST_TIMEOUT)
                
                if response.status_code == 401:
                    print("❌ Authentication required. Please provide a password.")
                    return None
                elif response.status_code == 403:
                    print("❌ Access denied. Invalid password.")
                    return None
                
                response.raise_for_status()
                print(f"✅ Successfully authenticated and fetched: {response.status_code}")
                return response.text
            except requests.RequestException as e:
                print(f"❌ Error: {e}")
                if attempt < MAX_RETRIES - 1:
                    print(f"⏳ Retrying in {RETRY_DELAY} seconds...")
                    time.sleep(RETRY_DELAY)
        return None

    def parse(self, html: str) -> dict:
        """Parse HTML and extract data."""
        soup = BeautifulSoup(html, "html.parser")
        
        return {
            "title": soup.title.string if soup.title else "No title",
            "headings": [h.get_text() for h in soup.find_all(["h1", "h2", "h3"])],
            "paragraphs": [p.get_text() for p in soup.find_all("p")],
            "links": [a.get("href") for a in soup.find_all("a")],
        }

    def scrape(self) -> Optional[dict]:
        """Scrape the website and return parsed data."""
        html = self.fetch()
        if html:
            return self.parse(html)
        return None


if __name__ == "__main__":
    # Prompt for password
    password = input("🔐 Enter the access password: ")
    
    scraper = WebScraper(TARGET_URL, password)
    data = scraper.scrape()
    
    if data:
        print("\n📄 Scraped Data:")
        print(f"Title: {data['title']}")
        print(f"Headings: {data['headings'][:3]}")
        print(f"Links found: {len(data['links'])}")
    else:
        print("Failed to scrape the website.")
