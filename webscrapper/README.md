# Web Scraper

A simple Python web scraper that fetches and parses HTML content from websites.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure `.env`:
```
TARGET_URL=https://example.com
REQUEST_TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=1
```

3. Run the scraper:
```bash
python main.py
```

## Features

- Fetches webpages with retry logic
- Parses HTML using BeautifulSoup
- Extracts titles, headings, paragraphs, and links
- Configurable timeout and retry settings
