#!/usr/bin/env python3
"""
Selenium-based Cloudflare Challenge Solver
This is the proper solution for JavaScript-based Cloudflare challenges
"""

import os
import time
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('selenium_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TARGET_URL = os.getenv("TARGET_URL", "https://test-cloudflare-website.adarsh.software/")


def check_selenium_installation():
    """Check if Selenium is installed and provide installation instructions"""
    try:
        import selenium
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        logger.info("✅ Selenium is installed")
        return True
    except ImportError:
        logger.error("❌ Selenium is not installed")
        logger.info("💡 To install Selenium:")
        logger.info("   pip install selenium")
        logger.info("   # Also need ChromeDriver:")
        logger.info("   # Download from: https://chromedriver.chromium.org/")
        logger.info("   # Or use: brew install chromedriver (on macOS)")
        return False


def scrape_with_selenium(url):
    """Scrape using Selenium to handle Cloudflare challenges"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.common.exceptions import TimeoutException, WebDriverException
        
        logger.info(f"🚀 Starting Selenium scraping of {url}")
        
        # Setup Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # For headless mode (uncomment if needed)
        # chrome_options.add_argument("--headless")
        
        logger.info("🌐 Starting Chrome browser...")
        driver = webdriver.Chrome(options=chrome_options)
        
        # Execute script to remove webdriver property
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        try:
            logger.info(f"📡 Loading page: {url}")
            driver.get(url)
            
            # Wait for Cloudflare challenge to complete
            logger.info("⏳ Waiting for Cloudflare challenge to complete...")
            
            # Wait up to 30 seconds for the page to load properly
            wait = WebDriverWait(driver, 30)
            
            # Check if we're still on a Cloudflare challenge page
            challenge_indicators = [
                "Just a moment...",
                "Checking your browser",
                "Please wait",
                "Verifying you are human"
            ]
            
            start_time = time.time()
            max_wait_time = 60  # Maximum 60 seconds
            
            while time.time() - start_time < max_wait_time:
                page_source = driver.page_source.lower()
                
                # Check if we're still in challenge
                in_challenge = any(indicator.lower() in page_source for indicator in challenge_indicators)
                
                if not in_challenge:
                    logger.info("✅ Cloudflare challenge completed!")
                    break
                    
                logger.info(f"⏳ Still in challenge... ({int(time.time() - start_time)}s elapsed)")
                time.sleep(3)
            else:
                logger.warning("⚠️ Challenge may still be active, proceeding anyway...")
            
            # Get final page content
            final_url = driver.current_url
            page_title = driver.title
            page_source = driver.page_source
            
            logger.info(f"📄 Final URL: {final_url}")
            logger.info(f"📄 Page Title: {page_title}")
            logger.info(f"📄 Content Length: {len(page_source)} characters")
            
            # Save the content
            os.makedirs("scraped_content", exist_ok=True)
            filename = f"scraped_content/selenium_scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"URL: {url}\n")
                f.write(f"Final URL: {final_url}\n")
                f.write(f"Title: {page_title}\n")
                f.write(f"Scraped at: {datetime.now().isoformat()}\n")
                f.write(f"Method: Selenium WebDriver\n")
                f.write("=" * 80 + "\n")
                f.write("PAGE SOURCE:\n")
                f.write("=" * 80 + "\n")
                f.write(page_source)
            
            logger.info(f"💾 Content saved to: {filename}")
            
            return {
                'success': True,
                'url': final_url,
                'title': page_title,
                'content_length': len(page_source),
                'filename': filename
            }
            
        except TimeoutException:
            logger.error("❌ Timeout waiting for page to load")
            return {'success': False, 'error': 'Timeout'}
            
        except Exception as e:
            logger.error(f"❌ Error during scraping: {e}")
            return {'success': False, 'error': str(e)}
            
        finally:
            logger.info("🔒 Closing browser...")
            driver.quit()
            
    except ImportError:
        logger.error("❌ Selenium not available")
        return {'success': False, 'error': 'Selenium not installed'}
    except WebDriverException as e:
        logger.error(f"❌ WebDriver error: {e}")
        logger.info("💡 Make sure ChromeDriver is installed and in PATH")
        return {'success': False, 'error': 'ChromeDriver not available'}
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return {'success': False, 'error': str(e)}


def create_installation_guide():
    """Create a guide for installing Selenium and ChromeDriver"""
    guide_content = """# Selenium Installation Guide for Cloudflare Bypass

## Prerequisites
This solution requires Selenium WebDriver to handle JavaScript-based Cloudflare challenges.

## Installation Steps

### 1. Install Selenium
```bash
pip install selenium
```

### 2. Install ChromeDriver

#### Option A: Using Homebrew (macOS)
```bash
brew install chromedriver
```

#### Option B: Manual Installation
1. Check your Chrome version: Chrome → About Chrome
2. Download matching ChromeDriver from: https://chromedriver.chromium.org/
3. Extract and place in PATH (e.g., /usr/local/bin/)

#### Option C: Using webdriver-manager (Automatic)
```bash
pip install webdriver-manager
```

### 3. Verify Installation
```bash
chromedriver --version
```

## Usage
Once installed, run:
```bash
python selenium_cloudflare_scraper.py
```

## Troubleshooting

### ChromeDriver Issues
- Ensure ChromeDriver version matches your Chrome browser
- Make sure ChromeDriver is in your system PATH
- Try running `chromedriver` command to test

### Permission Issues (macOS)
```bash
xattr -d com.apple.quarantine /usr/local/bin/chromedriver
```

### Alternative: Use Firefox
Install geckodriver for Firefox instead:
```bash
brew install geckodriver  # macOS
# Or download from: https://github.com/mozilla/geckodriver/releases
```

## Expected Results
- Automatically handles Cloudflare JavaScript challenges
- Waits for challenge completion (up to 60 seconds)
- Saves complete page content after bypass
- Works with most Cloudflare protection levels
"""
    
    with open("SELENIUM_INSTALLATION_GUIDE.md", "w") as f:
        f.write(guide_content)
    
    logger.info("📋 Created installation guide: SELENIUM_INSTALLATION_GUIDE.md")


def main():
    """Main function"""
    logger.info("🚀 Starting Selenium Cloudflare Scraper")
    
    # Check if Selenium is available
    if not check_selenium_installation():
        logger.info("📋 Creating installation guide...")
        create_installation_guide()
        logger.info("💡 Please install Selenium and ChromeDriver, then run this script again")
        return
    
    # Attempt scraping
    result = scrape_with_selenium(TARGET_URL)
    
    if result['success']:
        print("\n🎉 Selenium scraping successful!")
        print(f"Title: {result['title']}")
        print(f"Final URL: {result['url']}")
        print(f"Content Length: {result['content_length']} characters")
        print(f"Saved to: {result['filename']}")
        
        # Show content preview
        try:
            with open(result['filename'], 'r', encoding='utf-8') as f:
                content = f.read()
                # Find the actual page content (after the metadata)
                content_start = content.find("=" * 80 + "\nPAGE SOURCE:\n" + "=" * 80)
                if content_start != -1:
                    page_content = content[content_start + 170:]  # Skip the separator
                    print("\nContent preview (first 300 chars):")
                    print(page_content[:300] + "..." if len(page_content) > 300 else page_content)
        except Exception as e:
            logger.error(f"Error reading saved content: {e}")
            
    else:
        print(f"❌ Selenium scraping failed: {result['error']}")
        if result['error'] == 'Selenium not installed':
            print("💡 Run this script again after installing Selenium")
        elif 'ChromeDriver' in result['error']:
            print("💡 Install ChromeDriver: brew install chromedriver")
    
    logger.info("🏁 Selenium scraper complete")


if __name__ == "__main__":
    main()