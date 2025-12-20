# Selenium Installation Guide for Cloudflare Bypass

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
