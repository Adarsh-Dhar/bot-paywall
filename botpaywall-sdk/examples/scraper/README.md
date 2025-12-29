cat > botpaywall-sdk/examples/scraper/README.md <<'README'
# Plain Scraper (no bot-paywall-sdk integration)

## Overview
This example is a simple, general-purpose web scraper that fetches a page, parses HTML with BeautifulSoup, and writes the extracted content (title, headings, text, links, images, etc.) to an output file. It is intentionally NOT integrated with the bot-paywall-sdk—so it does not perform purchases, token verification, or any bot-paywall-specific flows. It's useful as a baseline scraper to compare how a non-integrated scraper behaves versus the `scraper-with-sdk` example that demonstrates using the SDK to interact with protected content.

## Included files
- `main.py` — CLI entrypoint (usage: `python main.py <url> [--output] [--format]`)
- `scraper.py` — `WebScraper` class: fetches pages with `requests` and parses with `BeautifulSoup`
- `utils.py` — helper functions: URL validation, filename generation, and save-to-file helpers (json, txt, html)
- `requirements.txt` — Python dependencies (requests, beautifulsoup4, lxml)
- `scrape/` — sample output JSON files created by example runs

## Quick start
1. Create and activate a virtualenv:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate