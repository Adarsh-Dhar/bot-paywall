"""
Web Scraper Module
Contains the main WebScraper class for scraping website content
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

logger = logging.getLogger(__name__)


class WebScraper:
    """Web scraper class to extract content from websites"""

    def __init__(self, url, timeout=10):
        """
        Initialize the web scraper

        Args:
            url (str): The URL to scrape
            timeout (int): Request timeout in seconds
        """
        self.url = url
        self.timeout = timeout
        self.soup = None
        self.response = None

        # Set up headers to mimic a browser
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def fetch_page(self):
        """
        Fetch the HTML content of the page

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Fetching page: {self.url}")
            self.response = requests.get(
                self.url,
                headers=self.headers,
                timeout=self.timeout,
                allow_redirects=True
            )
            self.response.raise_for_status()

            # Parse with BeautifulSoup
            self.soup = BeautifulSoup(self.response.content, 'html.parser')
            logger.info(f"Successfully fetched page (Status: {self.response.status_code})")
            return True

        except requests.exceptions.Timeout:
            logger.error(f"Request timed out after {self.timeout} seconds")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching page: {str(e)}")
            return False

    def extract_title(self):
        """Extract the page title"""
        if self.soup:
            title_tag = self.soup.find('title')
            return title_tag.get_text().strip() if title_tag else "No title found"
        return "No title found"

    def extract_meta_description(self):
        """Extract meta description"""
        if self.soup:
            meta_desc = self.soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                return meta_desc['content'].strip()
        return ""

    def extract_headings(self):
        """Extract all headings (h1-h6)"""
        headings = {}
        if self.soup:
            for i in range(1, 7):
                heading_tags = self.soup.find_all(f'h{i}')
                headings[f'h{i}'] = [h.get_text().strip() for h in heading_tags]
        return headings

    def extract_text(self):
        """Extract all text content from the page"""
        if self.soup:
            # Remove script and style elements
            for script in self.soup(['script', 'style', 'meta', 'link']):
                script.decompose()

            # Get text
            text = self.soup.get_text()

            # Clean up text
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)

            return text
        return ""

    def extract_links(self):
        """Extract all links from the page"""
        links = []
        if self.soup:
            for link in self.soup.find_all('a', href=True):
                href = link['href']
                # Convert relative URLs to absolute
                absolute_url = urljoin(self.url, href)
                text = link.get_text().strip()
                links.append({
                    'url': absolute_url,
                    'text': text if text else 'No text'
                })
        return links

    def extract_images(self):
        """Extract all images from the page"""
        images = []
        if self.soup:
            for img in self.soup.find_all('img'):
                src = img.get('src', '')
                alt = img.get('alt', '')

                if src:
                    # Convert relative URLs to absolute
                    absolute_url = urljoin(self.url, src)
                    images.append({
                        'url': absolute_url,
                        'alt': alt
                    })
        return images

    def extract_paragraphs(self):
        """Extract all paragraph text"""
        if self.soup:
            paragraphs = self.soup.find_all('p')
            return [p.get_text().strip() for p in paragraphs if p.get_text().strip()]
        return []

    def scrape(self):
        """
        Main scraping method that extracts all content

        Returns:
            dict: Dictionary containing all scraped data
        """
        # Fetch the page
        if not self.fetch_page():
            return None

        logger.info("Extracting content from page...")

        # Extract all data
        data = {
            'url': self.url,
            'title': self.extract_title(),
            'meta_description': self.extract_meta_description(),
            'headings': self.extract_headings(),
            'text': self.extract_text(),
            'paragraphs': self.extract_paragraphs(),
            'links': self.extract_links(),
            'images': self.extract_images(),
            'status_code': self.response.status_code if self.response else None,
            'content_type': self.response.headers.get('content-type', '') if self.response else ''
        }

        logger.info("Content extraction completed")
        return data