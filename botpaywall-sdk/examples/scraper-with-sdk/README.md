cat > botpaywall-sdk/examples/scraper-with-sdk/README.md <<'README'
# Scraper with bot-paywall-sdk integration

## Overview
This example demonstrates how to integrate the `botpaywall` SDK into a simple web-scraper flow. The example performs the SDK-based purchase/verification steps (via `BotPaywallClient`) before running the same scraping logic used in the plain scraper example. Use this example when scraping content protected by the bot-paywall flow that requires automated purchase/verification.

> Location: `botpaywall-sdk/examples/scraper-with-sdk/`

## Included files
- `main.py` — CLI entrypoint that uses the SDK before scraping.
- `scraper.py` — `WebScraper` class (fetch + parse via `requests` + `BeautifulSoup`).
- `utils.py` — helpers for validation and saving output (json, txt, html).
- `requirements.txt` — Python dependencies required by the example.
- `.env` — (example) local environment variables used for the demo.
- `scrape/` — sample output JSON files created by example runs.

## Required environment variables
- `WALLET_PRIVATE_KEY` — private key used by the SDK to perform the purchase/transaction.
  Example (in `.env`):