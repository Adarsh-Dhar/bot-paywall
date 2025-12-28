# BotPaywall SDK

A Python SDK for integrating bot-paywall functionality into your web scrapers and automated tools. This SDK handles cryptocurrency-based access payments for websites protected by the BotPaywall system.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Converting an Existing Scraper](#converting-an-existing-scraper)
- [Environment Setup](#environment-setup)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
pip install botpaywall
```

Or install from source:

```bash
cd botpaywall-sdk
pip install -e .
```

## Quick Start

```python
from botpaywall import BotPaywallClient
from botpaywall.utils import extract_domain_from_url

# Initialize the client
client = BotPaywallClient(
    access_server_url='http://localhost:5000',
    main_app_url='http://localhost:3000',
    private_key='your-wallet-private-key',
)

# Buy access to a domain
result = client.buy_access(domain='example.com')

if result['success']:
    # Wait for the payment to propagate
    client.wait_for_propagation()
    
    # Now you can scrape the website
    print("Access granted! You can now scrape the website.")
else:
    print(f"Access denied: {result.get('error')}")
```

## Configuration

### Client Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `access_server_url` | str | Required | URL of the BotPaywall access server |
| `main_app_url` | str | Required | URL of the main BotPaywall application |
| `private_key` | str | Required | Your wallet's private key for payments |
| `wait_after_payment` | int | `10` | Seconds to wait after payment for propagation |
| `max_retries` | int | `3` | Maximum retry attempts for failed operations |

### Example Configuration

```python
CONFIG = {
    'access_server_url': 'http://localhost:5000',
    'main_app_url': 'http://localhost:3000',
    'max_retries': 3,
    'wait_after_payment': 10,
}
```

## API Reference

### `BotPaywallClient`

#### Constructor

```python
BotPaywallClient(
    access_server_url: str,
    main_app_url: str,
    private_key: str,
    wait_after_payment: int = 10,
    max_retries: int = 3
)
```

#### Methods

##### `buy_access(domain: str) -> dict`

Purchases access to a specific domain.

**Parameters:**
- `domain` (str): The domain to buy access for (e.g., `"example.com"`)

**Returns:**
```python
{
    'success': bool,      # Whether access was granted
    'error': str | None,  # Error message if failed
    # ... additional metadata
}
```

##### `wait_for_propagation() -> None`

Waits for the payment to propagate through the network. Call this after a successful `buy_access()` before attempting to scrape.

### Utility Functions

#### `extract_domain_from_url(url: str) -> str | None`

Extracts the domain from a full URL.

```python
from botpaywall.utils import extract_domain_from_url

domain = extract_domain_from_url('https://www.example.com/page')
# Returns: 'example.com'
```

## Converting an Existing Scraper

This section provides a step-by-step guide to convert a normal web scraper to use BotPaywall.

### Before (Normal Scraper)

```python
#!/usr/bin/env python3
import sys
from scraper import WebScraper
from utils import validate_url, save_to_file
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    url = sys.argv[1]
    
    if not validate_url(url):
        logger.error(f"Invalid URL: {url}")
        sys.exit(1)

    # Directly scrape without any access check
    scraper = WebScraper(url)
    data = scraper.scrape()
    
    save_to_file(data, url, None, 'json')

if __name__ == "__main__":
    main()
```

### After (BotPaywall Integrated)

```python
#!/usr/bin/env python3
import sys
import os
from scraper import WebScraper
from utils import validate_url, save_to_file
import logging

# Step 1: Import BotPaywall SDK
from botpaywall import BotPaywallClient
from botpaywall.utils import extract_domain_from_url

# Step 2: Load environment variables
from pathlib import Path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Step 3: Define configuration
CONFIG = {
    'access_server_url': 'http://localhost:5000',
    'main_app_url': 'http://localhost:3000',
    'max_retries': 3,
    'wait_after_payment': 10,
}

def main():
    url = sys.argv[1]
    
    if not validate_url(url):
        logger.error(f"Invalid URL: {url}")
        sys.exit(1)

    # Step 4: Get private key from environment
    private_key = os.environ.get('WALLET_PRIVATE_KEY')
    if not private_key:
        logger.error("Private key not provided. Set WALLET_PRIVATE_KEY in .env")
        sys.exit(1)

    # Step 5: Initialize BotPaywall client
    client = BotPaywallClient(
        access_server_url=CONFIG['access_server_url'],
        main_app_url=CONFIG['main_app_url'],
        private_key=private_key,
        wait_after_payment=CONFIG['wait_after_payment'],
        max_retries=CONFIG['max_retries'],
    )

    # Step 6: Extract domain and buy access
    target_domain = extract_domain_from_url(url)
    if not target_domain:
        logger.error("Could not extract domain from URL")
        sys.exit(1)

    result = client.buy_access(domain=target_domain)

    if not result['success']:
        logger.error(f"Access not granted: {result.get('error')}")
        sys.exit(1)

    # Step 7: Wait for payment propagation
    client.wait_for_propagation()

    # Step 8: Now scrape as usual
    scraper = WebScraper(url)
    data = scraper.scrape()
    
    save_to_file(data, url, None, 'json')

if __name__ == "__main__":
    main()
```

### Summary of Changes

| Step | Change | Description |
|------|--------|-------------|
| 1 | Add imports | Import `BotPaywallClient` and `extract_domain_from_url` |
| 2 | Load `.env` | Read environment variables from `.env` file |
| 3 | Add config | Define access server URLs and retry settings |
| 4 | Get private key | Read wallet private key from environment |
| 5 | Initialize client | Create `BotPaywallClient` instance |
| 6 | Buy access | Extract domain and call `buy_access()` |
| 7 | Wait | Call `wait_for_propagation()` |
| 8 | Scrape | Proceed with normal scraping logic |

## Environment Setup

### Create a `.env` File

Create a `.env` file in your project directory:

```env
# .env
WALLET_PRIVATE_KEY=your_private_key_here
```

> ⚠️ **Security Warning**: Never commit your `.env` file to version control. Add it to your `.gitignore`.

### `.gitignore` Entry

```gitignore
# Environment variables
.env
.env.local
```

## Examples

### Basic Usage

```python
from botpaywall import BotPaywallClient
from botpaywall.utils import extract_domain_from_url
import os

client = BotPaywallClient(
    access_server_url='http://localhost:5000',
    main_app_url='http://localhost:3000',
    private_key=os.environ['WALLET_PRIVATE_KEY'],
)

url = 'https://protected-site.com/data'
domain = extract_domain_from_url(url)

result = client.buy_access(domain=domain)

if result['success']:
    client.wait_for_propagation()
    # Scrape the URL...
```

### With Error Handling

```python
from botpaywall import BotPaywallClient
from botpaywall.utils import extract_domain_from_url
import os
import logging

logger = logging.getLogger(__name__)

def scrape_with_paywall(url: str) -> dict | None:
    """Scrape a URL with BotPaywall integration."""
    
    private_key = os.environ.get('WALLET_PRIVATE_KEY')
    if not private_key:
        raise ValueError("WALLET_PRIVATE_KEY not set")
    
    client = BotPaywallClient(
        access_server_url='http://localhost:5000',
        main_app_url='http://localhost:3000',
        private_key=private_key,
        max_retries=3,
    )
    
    try:
        domain = extract_domain_from_url(url)
        if not domain:
            raise ValueError(f"Invalid URL: {url}")
        
        logger.info(f"Buying access for domain: {domain}")
        result = client.buy_access(domain=domain)
        
        if not result['success']:
            logger.error(f"Failed to buy access: {result.get('error')}")
            return None
        
        logger.info("Access granted, waiting for propagation...")
        client.wait_for_propagation()
        
        # Your scraping logic here
        logger.info("Starting scrape...")
        # scraper = WebScraper(url)
        # return scraper.scrape()
        
    except Exception as e:
        logger.error(f"Error during scrape: {e}")
        raise
```

### Integration with argparse CLI

```python
import argparse
from botpaywall import BotPaywallClient
from botpaywall.utils import extract_domain_from_url
import os

def main():
    parser = argparse.ArgumentParser(description='BotPaywall-enabled scraper')
    parser.add_argument('url', help='URL to scrape')
    parser.add_argument('--access-server', default='http://localhost:5000')
    parser.add_argument('--main-app', default='http://localhost:3000')
    args = parser.parse_args()
    
    client = BotPaywallClient(
        access_server_url=args.access_server,
        main_app_url=args.main_app,
        private_key=os.environ['WALLET_PRIVATE_KEY'],
    )
    
    domain = extract_domain_from_url(args.url)
    result = client.buy_access(domain=domain)
    
    if result['success']:
        client.wait_for_propagation()
        print(f"Ready to scrape {args.url}")

if __name__ == '__main__':
    main()
```

## Troubleshooting

### Common Errors

#### "Private key not provided"

**Cause:** The `WALLET_PRIVATE_KEY` environment variable is not set.

**Solution:**
1. Create a `.env` file with `WALLET_PRIVATE_KEY=your_key`
2. Or export it directly: `export WALLET_PRIVATE_KEY=your_key`

#### "Could not extract domain from URL"

**Cause:** The URL format is invalid.

**Solution:** Ensure the URL includes the protocol (http:// or https://).

```python
# ❌ Wrong
domain = extract_domain_from_url('example.com')

# ✅ Correct
domain = extract_domain_from_url('https://example.com')
```

#### "Access not granted"

**Cause:** Payment failed or insufficient funds.

**Solution:**
1. Check your wallet balance
2. Verify the access server is running
3. Check network connectivity

### Debug Mode

Enable verbose logging to debug issues:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Or with the CLI:

```bash
python main.py https://example.com --verbose
```

## License

MIT License - see LICENSE file for details.

