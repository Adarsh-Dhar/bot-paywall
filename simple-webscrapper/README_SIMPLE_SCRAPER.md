# Simple Webscraper

This directory contains simple webscraper tools to scrape https://test-cloudflare-website.adarsh.software/

## Files Created

### 1. `simple_scraper.py`
Basic webscraper that attempts to scrape the target website and logs the response.

**Usage:**
```bash
python3 simple_scraper.py
```

### 2. `enhanced_scraper.py`
Enhanced webscraper with detailed logging, response analysis, and file saving capabilities.

**Features:**
- Detailed response logging (status, headers, cookies)
- Content analysis and detection of Cloudflare protection
- Saves HTML content and metadata to files
- Better error handling and reporting

**Usage:**
```bash
python3 enhanced_scraper.py
```

### 3. `run_simple_scraper.sh`
Convenience script that sets up the environment and runs the basic scraper.

**Usage:**
```bash
./run_simple_scraper.sh
```

## Expected Behavior

The target website (https://test-cloudflare-website.adarsh.software/) is protected by Cloudflare's bot detection system. When accessed by these scrapers, you will typically see:

- **Status Code:** 403 (Forbidden)
- **Content:** Cloudflare challenge page with "Just a moment..." message
- **Headers:** `cf-mitigated: challenge` indicating bot protection is active

This is normal behavior for Cloudflare-protected sites when accessed by automated tools.

## Output Files

The enhanced scraper creates timestamped files:
- `scrape_result_YYYYMMDD_HHMMSS.html` - Full HTML content received
- `scrape_result_YYYYMMDD_HHMMSS_metadata.json` - Response metadata (headers, status, etc.)

## Requirements

- Python 3.x
- requests library (included in requirements.txt)

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or use the convenience script
./run_simple_scraper.sh
```