# Web Scraper with Password Authentication

A simple Python web scraper that fetches and parses HTML content from password-protected websites.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure `.env`:
```
TARGET_URL=https://test-cloudflare-website.adarsh.software/
REQUEST_TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=1
```

3. Run the scraper:
```bash
python main.py
```

4. When prompted, enter the access password.

## Features

- Fetches webpages with password authentication
- Parses HTML using BeautifulSoup
- Extracts titles, headings, paragraphs, and links
- Configurable timeout and retry settings
- Interactive password prompt
