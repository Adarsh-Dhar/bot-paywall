#!/bin/bash

# Check if Project ID is provided
if [ -z "$1" ]; then
  echo "Error: Project ID is required."
  echo "Usage: ./run.sh <project_id>"
  exit 1
fi

echo "Running Simple Webscraper for Project ID: $1"
echo ""

# Install requirements if needed
pip install -r requirements.txt

# Run the scraper with the project ID
python3 scraper.py --project "$1"