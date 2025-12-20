# Simple Webscraper

A minimal Python webscraper that scrapes https://test-cloudflare-website.adarsh.software/ and logs the content.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the scraper:
```bash
python scraper.py
```

The scraper will:
- Make a GET request to the target website
- Log the HTTP status code and content length
- Display the full website content in the logs
- Handle errors gracefully with proper logging