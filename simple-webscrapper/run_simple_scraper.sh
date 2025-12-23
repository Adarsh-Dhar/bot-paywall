#!/bin/bash

# Simple script to run the webscraper

echo "Running Simple Webscraper..."
echo "Target URL: https://test-cloudflare-website.adarsh.software/"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Run the scraper
echo "Starting scraper..."
python simple_scraper.py

echo "Scraper completed!"