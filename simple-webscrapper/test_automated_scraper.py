#!/usr/bin/env python3
"""
Test script for the automated scraper with IP whitelisting
"""

import time
import logging
from automated_scraper import AutomatedScraper, CloudflareIPManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_ip_manager():
    """Test the Cloudflare IP manager"""
    logger.info("🧪 Testing Cloudflare IP Manager...")
    
    try:
        ip_manager = CloudflareIPManager()
        
        # Test getting current IP
        current_ip = ip_manager.get_current_ip()
        logger.info(f"✅ Current IP: {current_ip}")
        
        # Test creating whitelist rule
        rule_id = ip_manager.create_whitelist_rule(current_ip)
        if rule_id:
            logger.info(f"✅ Created whitelist rule: {rule_id}")
            
            # Wait a moment
            time.sleep(2)
            
            # Test finding existing rule
            found_rule = ip_manager.find_existing_rule(current_ip)
            if found_rule == rule_id:
                logger.info("✅ Successfully found existing rule")
            else:
                logger.warning(f"⚠️ Found different rule: {found_rule} vs {rule_id}")
            
            # Test removing rule
            if ip_manager.remove_whitelist_rule(rule_id):
                logger.info("✅ Successfully removed rule")
            else:
                logger.error("❌ Failed to remove rule")
        else:
            logger.error("❌ Failed to create whitelist rule")
            
    except Exception as e:
        logger.error(f"❌ IP Manager test failed: {e}")


def test_automated_scraper():
    """Test the full automated scraper"""
    logger.info("🧪 Testing Automated Scraper...")
    
    try:
        scraper = AutomatedScraper()
        
        # Test scraping
        content = scraper.scrape_website()
        
        if content:
            logger.info("✅ Automated scraper test passed!")
            logger.info(f"📄 Content length: {len(content)} characters")
        else:
            logger.error("❌ Automated scraper test failed!")
            
    except Exception as e:
        logger.error(f"❌ Automated scraper test failed: {e}")


def test_manual_whitelist_cycle():
    """Test manual whitelist creation and removal cycle"""
    logger.info("🧪 Testing manual whitelist cycle...")
    
    try:
        ip_manager = CloudflareIPManager()
        current_ip = ip_manager.get_current_ip()
        
        # Create rule
        logger.info("Creating whitelist rule...")
        rule_id = ip_manager.create_whitelist_rule(current_ip)
        
        if rule_id:
            logger.info(f"✅ Rule created: {rule_id}")
            
            # Wait 5 seconds
            logger.info("⏳ Waiting 5 seconds...")
            time.sleep(5)
            
            # Remove rule
            logger.info("Removing whitelist rule...")
            if ip_manager.remove_whitelist_rule(rule_id):
                logger.info("✅ Rule removed successfully")
            else:
                logger.error("❌ Failed to remove rule")
        else:
            logger.error("❌ Failed to create rule")
            
    except Exception as e:
        logger.error(f"❌ Manual whitelist cycle test failed: {e}")


if __name__ == "__main__":
    logger.info("🚀 Starting automated scraper tests...")
    
    # Test 1: IP Manager functionality
    test_ip_manager()
    
    print("\n" + "="*50 + "\n")
    
    # Test 2: Manual whitelist cycle
    test_manual_whitelist_cycle()
    
    print("\n" + "="*50 + "\n")
    
    # Test 3: Full automated scraper
    test_automated_scraper()
    
    logger.info("🏁 All tests completed!")