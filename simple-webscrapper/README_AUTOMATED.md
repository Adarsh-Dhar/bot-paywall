# Automated Bot Payment System

This system provides automated IP whitelisting and X402 payment integration for web scraping. It automatically manages the complete workflow:

1. **Auto-whitelist IP** when scraper runs
2. **Make X402 payment** if required by the server
3. **Scrape content** successfully
4. **Auto-remove IP** after 60 seconds
5. **Repeat process** for subsequent runs

## Quick Start

### Option 1: Drop-in Replacement
Replace your existing scraper calls with the automated version:

```bash
# Instead of: python scraper.py
python scraper_automated.py
```

### Option 2: Use the Full Automated System
```bash
python automated_scraper.py
```

### Option 3: Run Demo
```bash
python demo_workflow.py
```

## How It Works

### Workflow
1. **IP Detection**: Automatically detects current public IP using `icanhazip.com`
2. **Whitelist Check**: Checks if IP is already whitelisted in Cloudflare
3. **Rule Creation**: Creates new whitelist rule if needed
4. **Scheduled Cleanup**: Schedules automatic removal after 60 seconds
5. **Access Test**: Tests website access
6. **Payment Handling**: Makes X402 payment if 402 status received
7. **Content Scraping**: Scrapes website content
8. **Auto-Cleanup**: Background thread removes IP after 60 seconds

### Key Features
- ✅ **Automatic IP whitelisting** via Cloudflare API
- ✅ **60-second subscription model** with auto-cleanup
- ✅ **X402 payment integration** with MOVE tokens
- ✅ **Rule reuse** for rapid successive runs
- ✅ **Error handling** and retry logic
- ✅ **Comprehensive logging** of all operations
- ✅ **Background cleanup** using threading

## Configuration

### Environment Variables
```bash
# Blockchain Configuration
MOVE_NETWORK_ID=testnet
MOVE_RPC_ENDPOINT=https://testnet.movementnetwork.xyz/v1
MOVE_PRIVATE_KEY=your_private_key_here

# Payment Configuration  
PAYMENT_ADDRESS=0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b

# Cloudflare Configuration (for IP whitelisting)
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ZONE_ID=your_zone_id

# Client IP (fallback if auto-detection fails)
CLIENT_IP=your_ip_address
```

## Files

### Core System
- `automated_scraper.py` - Main automated scraper with full functionality
- `scraper_automated.py` - Drop-in replacement for original scraper.py
- `real_payment_handler.py` - MOVE blockchain payment handler

### Testing & Demo
- `test_automated_scraper.py` - Test suite for all components
- `demo_workflow.py` - Complete workflow demonstration
- `test_cloudflare_api.py` - Cloudflare API connectivity test

### Configuration
- `.env` - Environment configuration
- `README_AUTOMATED.md` - This documentation

## Usage Examples

### Basic Usage
```python
from automated_scraper import AutomatedScraper

scraper = AutomatedScraper()
content = scraper.scrape_website("https://example.com")
if content:
    print("Scraping successful!")
```

### Manual IP Management
```python
from automated_scraper import CloudflareIPManager

ip_manager = CloudflareIPManager()
current_ip = ip_manager.get_current_ip()
rule_id = ip_manager.create_whitelist_rule(current_ip)

# Schedule removal after 60 seconds
ip_manager.schedule_rule_removal(rule_id, 60)
```

## Logs

The system provides comprehensive logging:

```
2025-12-23 12:19:08,595 - INFO - 🤖 Starting automated scraper with IP whitelisting
2025-12-23 12:19:10,177 - INFO - 💰 Current balance: 9.80218300 MOVE
2025-12-23 12:19:10,856 - INFO - 🌐 Current IP address: 157.41.240.143
2025-12-23 12:19:13,643 - INFO - ✅ Created whitelist rule for 157.41.240.143: 5acdc12dbbe44786bc72df5cc1930db4
2025-12-23 12:19:13,646 - INFO - 📅 Scheduled rule 5acdc12dbbe44786bc72df5cc1930db4 for removal in 60 seconds
2025-12-23 12:19:18,672 - INFO - ✅ Access granted - no payment required
2025-12-23 12:19:20,441 - INFO - ✅ Successfully scraped website. Status code: 200
```

## Error Handling

The system handles various error conditions:
- Invalid Cloudflare API tokens
- Network connectivity issues
- Payment failures
- IP detection failures
- Website access errors

## Security

- API tokens are loaded from environment variables
- Private keys are handled securely by the Aptos SDK
- Whitelist rules are automatically cleaned up
- All operations are logged for audit purposes

## Performance

- **Rule Reuse**: Existing rules are reused for rapid successive runs
- **Background Cleanup**: Cleanup operations run in background threads
- **Efficient API Calls**: Minimal API calls through smart caching
- **Fast IP Detection**: Uses reliable IP detection service

## Troubleshooting

### Common Issues

1. **403 Forbidden from Cloudflare API**
   - Check API token permissions
   - Verify zone ID is correct

2. **Payment Failures**
   - Check MOVE token balance
   - Verify private key is correct
   - Ensure network connectivity

3. **IP Detection Failures**
   - Check internet connectivity
   - Set CLIENT_IP as fallback

### Debug Mode
Set logging level to DEBUG for detailed information:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Integration

This system can be integrated into existing workflows:

```bash
# Cron job for regular scraping
0 */6 * * * cd /path/to/scraper && python scraper_automated.py

# Docker container
docker run -v $(pwd):/app -w /app python:3.9 python scraper_automated.py

# CI/CD pipeline
- name: Run Automated Scraper
  run: python scraper_automated.py
```

## Support

For issues or questions:
1. Check the logs for error details
2. Run the test suite: `python test_automated_scraper.py`
3. Test API connectivity: `python test_cloudflare_api.py`
4. Review environment configuration