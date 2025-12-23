#!/usr/bin/env python3
"""
Demo script showing the exact workflow:
1. Run scraper
2. Auto-whitelist IP if not whitelisted
3. Make X402 payment if required
4. Scrape content
5. Auto-remove IP after 60 seconds
6. Repeat process for subsequent runs
"""

import time
import logging
from automated_scraper import AutomatedScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def demo_single_run():
    """Demonstrate a single scraping run"""
    logger.info("🎬 DEMO: Single scraping run")
    logger.info("=" * 60)
    
    scraper = AutomatedScraper()
    content = scraper.scrape_website()
    
    if content:
        logger.info("✅ Single run completed successfully!")
        return True
    else:
        logger.error("❌ Single run failed!")
        return False


def demo_multiple_runs_with_timing():
    """Demonstrate multiple runs with timing to show the 60-second cycle"""
    logger.info("🎬 DEMO: Multiple runs with 60-second cycle")
    logger.info("=" * 60)
    
    for run_number in range(3):
        logger.info(f"\n🔄 RUN #{run_number + 1}")
        logger.info("-" * 30)
        
        start_time = time.time()
        
        scraper = AutomatedScraper()
        content = scraper.scrape_website()
        
        end_time = time.time()
        duration = end_time - start_time
        
        if content:
            logger.info(f"✅ Run #{run_number + 1} completed in {duration:.2f} seconds")
        else:
            logger.error(f"❌ Run #{run_number + 1} failed after {duration:.2f} seconds")
        
        # Wait between runs to demonstrate the cycle
        if run_number < 2:  # Don't wait after the last run
            wait_time = 70  # Wait 70 seconds to ensure IP is removed
            logger.info(f"⏳ Waiting {wait_time} seconds for IP to be removed from whitelist...")
            time.sleep(wait_time)


def demo_rapid_succession():
    """Demonstrate rapid successive runs (should reuse whitelist)"""
    logger.info("🎬 DEMO: Rapid successive runs (should reuse whitelist)")
    logger.info("=" * 60)
    
    for run_number in range(3):
        logger.info(f"\n⚡ RAPID RUN #{run_number + 1}")
        logger.info("-" * 30)
        
        start_time = time.time()
        
        scraper = AutomatedScraper()
        content = scraper.scrape_website()
        
        end_time = time.time()
        duration = end_time - start_time
        
        if content:
            logger.info(f"✅ Rapid run #{run_number + 1} completed in {duration:.2f} seconds")
        else:
            logger.error(f"❌ Rapid run #{run_number + 1} failed after {duration:.2f} seconds")
        
        # Short wait between rapid runs
        if run_number < 2:
            logger.info("⏳ Waiting 5 seconds before next rapid run...")
            time.sleep(5)


if __name__ == "__main__":
    logger.info("🚀 Starting Automated Bot Payment System Demo")
    logger.info("This demo shows the complete workflow:")
    logger.info("1. Auto-whitelist IP")
    logger.info("2. Make X402 payment if required")
    logger.info("3. Scrape content")
    logger.info("4. Auto-remove IP after 60 seconds")
    logger.info("5. Repeat for subsequent runs")
    
    print("\n" + "="*80 + "\n")
    
    try:
        # Demo 1: Single run
        demo_single_run()
        
        print("\n" + "="*80 + "\n")
        
        # Demo 2: Rapid succession (should reuse whitelist)
        demo_rapid_succession()
        
        print("\n" + "="*80 + "\n")
        
        # Demo 3: Multiple runs with timing
        logger.info("🎬 FINAL DEMO: Testing 60-second expiration cycle")
        logger.info("This will take about 3-4 minutes to complete...")
        demo_multiple_runs_with_timing()
        
    except KeyboardInterrupt:
        logger.info("⏹️ Demo interrupted by user")
    except Exception as e:
        logger.error(f"❌ Demo failed with error: {e}")
    
    logger.info("🏁 Demo completed!")