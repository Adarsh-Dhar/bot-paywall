#!/bin/bash

echo "Running Simple Webscraper..."
echo "Target: https://test-cloudflare-website.adarsh.software/"
echo ""

# Install requirements if needed
pip install -r requirements.txt

# Run the scraper
python3 scraper.py