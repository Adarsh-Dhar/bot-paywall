#!/usr/bin/env python3
"""
Bot-Paywall Simple Bot Scraper - x402 Payment Flow
========================================================
This scraper is designed specifically for the bot-paywall project.
It communicates with the bot-paywall access-server to handle x402 payments and IP whitelisting.

The scraper fetches your protected projects from the bot-paywall main app and handles all
payment logic transparently, allowing bots to scrape protected websites.

CONFIGURATION:
    - target_url: URL to scrape (can be overridden with --url or --project)
    - access_server_url: Access server that handles x402 payments (default: http://localhost:5000)
    - main_app_url: Bot-paywall main app for fetching projects (default: http://localhost:3000)

USAGE:
    python scraper.py                           # Use default target URL
    python scraper.py --url https://example.com # Specify a target URL
    python scraper.py --project 1               # Use bot-paywall project by index
    python scraper.py --project example.com     # Use bot-paywall project by domain
    python scraper.py --list-projects           # List all bot-paywall projects
"""

import requests
import json
import time
import argparse
import sys
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # Target website (behind Cloudflare Worker paywall)
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    
    # Access server (handles x402 payments and whitelisting)
    'access_server_url': 'http://localhost:5000',
    
    # Main app API URL (for fetching projects)
    'main_app_url': 'http://localhost:3000',

    # Retry settings
    'max_retries': 3,
    'wait_after_payment': 10,  # seconds to wait for whitelisting to propagate
    'retry_delay': 5  # seconds between retries
}

# =============================================================================
# BOT HEADERS - Intentionally identifies as a bot
# =============================================================================

BOT_HEADERS = {
    'User-Agent': 'BotPaywall-Scraper/1.0 python-requests',  # Explicitly identifies as scraper for Worker bot detection
    'Accept': 'application/json',  # Bot-like accept header
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def log(message, level="INFO"):
    """Print formatted log message"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icons = {
        "INFO": "ℹ️ ",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "PAYMENT": "💳",
        "WAIT": "⏳",
        "SCRAPE": "🔍",
        "LOCK": "🔐",
        "SAVE": "💾"
    }
    icon = icons.get(level, "  ")
    print(f"[{timestamp}] {icon} {message}")

def get_project_credentials(project_id):
    """
    Fetch full project details including secrets from the main app.
    Uses the public endpoint that doesn't require authentication.
    Returns zone_id and secret_key needed for Cloudflare whitelisting.
    """
    try:
        url = f"{CONFIG['main_app_url']}/api/projects/public?id={project_id}"

        log(f"Fetching credentials for project {project_id}...", "INFO")
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if not data.get('success'):
                log(f"API returned success=false: {data.get('error', 'Unknown error')}", "ERROR")
                return None

            project = data.get('project')
            if not project:
                log("No project data in response", "ERROR")
                return None

            zone_id = project.get('zoneId')
            secret_key = project.get('secretKey')

            if not zone_id or not secret_key:
                log("Missing zoneId or secretKey in project data", "ERROR")
                return None

            log(f"✓ Zone ID: {zone_id[:20]}...", "SUCCESS")
            log(f"✓ API Token: {secret_key[:20]}...", "SUCCESS")

            return {
                'url': project.get('websiteUrl'),
                'zone_id': zone_id,
                'secret_key': secret_key
            }
        elif response.status_code == 404:
            log(f"Project not found: {project_id}", "ERROR")
            return None
        else:
            log(f"Failed to fetch project credentials: {response.status_code}", "ERROR")
            try:
                error_data = response.json()
                log(f"Error details: {error_data.get('error', 'Unknown')}", "ERROR")
            except:
                log(f"Response: {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"Error fetching credentials: {e}", "ERROR")
        return None



def get_payment_info():
    """
    Get payment information from access server.
    """
    try:
        log("Getting payment information from access server...", "INFO")
        
        response = requests.get(
            f"{CONFIG['access_server_url']}/payment-info",
            timeout=10
        )
        
        if response.status_code == 200:
            info = response.json()
            log("Payment information retrieved", "SUCCESS")
            return info
        else:
            log(f"Failed to get payment info: {response.status_code}", "ERROR")
            return None
            
    except Exception as e:
        log(f"Error getting payment info: {e}", "ERROR")
        return None

def check_access_status(ip, domain):
    """
    Check if IP is whitelisted.
    Args:
        ip: The IP address to check
        domain: The domain name (e.g., 'test-cloudflare-website.adarsh.software')
    """
    try:
        response = requests.get(
            f"{CONFIG['access_server_url']}/check-access/{ip}",
            params={'domain': domain},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('whitelisted', False)
        
        return False
            
    except Exception as e:
        log(f"Error checking access status: {e}", "ERROR")
        return False


def make_blockchain_payment(payment_address, amount):
    """
    Make actual MOVE token payment using Movement blockchain.
    """
    import asyncio
    from aptos_sdk.account import Account
    from aptos_sdk.async_client import RestClient
    from aptos_sdk.account_address import AccountAddress
    
    async def _make_payment():
        # Load your wallet from private key
        account = Account.load_key("0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871")
        
        # Create REST client for Movement testnet
        client = RestClient("https://testnet.movementnetwork.xyz/v1")
        
        try:
            # Convert payment address to AccountAddress
            recipient = AccountAddress.from_str(payment_address)
            
            # Transfer coins (amount is in octas)
            # coin_type: "0x1::aptos_coin::AptosCoin" for Movement/MOVE tokens
            # transfer_coins returns the transaction hash
            txn_hash = await client.transfer_coins(
                sender=account,
                recipient=recipient,
                amount=amount,
                coin_type="0x1::aptos_coin::AptosCoin"
            )
            
            # Wait for transaction to complete
            await client.wait_for_transaction(txn_hash)
            
            return txn_hash
        finally:
            await client.close()
    
    # Run the async function
    return asyncio.run(_make_payment())        

def buy_access(scraper_ip, domain, zone_id=None, secret_key=None):
    """
    Purchase access for scraper IP.
    Args:
        scraper_ip: The IP address of the scraper
        domain: The domain name
        zone_id: Cloudflare Zone ID (required for whitelisting)
        secret_key: Cloudflare API token (required for whitelisting)
    """
    try:
        # Build request payload
        payload = {
            'scraper_ip': scraper_ip,
            'domain': domain
        }

        # Add Cloudflare credentials if provided
        if zone_id and secret_key:
            payload['zone_id'] = zone_id
            payload['secret_key'] = secret_key
            log(f"Using Cloudflare credentials for zone: {zone_id[:20]}...", "INFO")
        else:
            log("WARNING: No Cloudflare credentials provided - whitelisting may fail", "ERROR")

        # First attempt - will get 402 with payment instructions
        response = requests.post(
            f"{CONFIG['access_server_url']}/buy-access",
            json=payload,
            timeout=120
        )

        if response.status_code == 402:
            payment_header = response.headers.get('X-PAYMENT-RESPONSE')
            payment_data = response.json()

            log("Making blockchain payment...", "PAYMENT")

            accepts = payment_data.get('accepts', [])
            if not accepts or len(accepts) == 0:
                log(f"Invalid payment data: no accepts array found", "ERROR")
                return False

            payment_option = accepts[0]
            payment_address = payment_option.get('payTo')
            max_amount_octas = payment_option.get('maxAmountRequired')

            if max_amount_octas:
                amount_move = int(max_amount_octas) / 100000000
            else:
                amount_move = None

            if not payment_address or not amount_move:
                log(f"Invalid payment data: missing payTo or maxAmountRequired", "ERROR")
                return False

            log(f"Payment Address: {payment_address}", "INFO")
            log(f"Amount: {amount_move} MOVE ({max_amount_octas} octas)", "INFO")

            # Make payment
            amount_octas_int = int(max_amount_octas)
            tx_hash = make_blockchain_payment(payment_address, amount_octas_int)

            log(f"Payment made: {tx_hash}", "SUCCESS")

            # Wait for blockchain confirmation
            log("Waiting for transaction confirmation...", "WAIT")
            time.sleep(3)

            # Retry with payment proof AND Cloudflare credentials
            retry_payload = {
                'scraper_ip': scraper_ip,
                'domain': domain,
                'tx_hash': tx_hash
            }

            # Include Cloudflare credentials in retry
            if zone_id and secret_key:
                retry_payload['zone_id'] = zone_id
                retry_payload['secret_key'] = secret_key

            log(f"Retrying request with payment proof: {tx_hash}", "INFO")
            response = requests.post(
                f"{CONFIG['access_server_url']}/buy-access",
                json=retry_payload,
                headers={
                    'X-PAYMENT-PROOF': tx_hash,
                    'X-Payment-Proof': tx_hash,
                    'X-Payment-Hash': tx_hash
                },
                timeout=120
            )

            log(f"Response status: {response.status_code}", "INFO")

            if response.status_code == 200:
                data = response.json()
                log("Access granted!", "SUCCESS")
                log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
                log(f"   Status: {data.get('status', 'unknown')}", "INFO")
                if 'rule_id' in data:
                    log(f"   Cloudflare Rule ID: {data['rule_id']}", "SUCCESS")
                if 'transaction' in data:
                    tx_info = data['transaction']
                    if 'hash' in tx_info:
                        log(f"   Transaction Hash: {tx_info['hash']}", "INFO")
                return True
            else:
                log(f"Failed after payment: {response.status_code}", "ERROR")
                try:
                    error_data = response.json()
                    log(f"Error response: {error_data}", "ERROR")
                except:
                    log(f"Error response text: {response.text}", "ERROR")
                return False

        elif response.status_code == 200:
            data = response.json()
            log("Access granted!", "SUCCESS")
            log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
            log(f"   Status: {data.get('status', 'unknown')}", "INFO")
            return True

        else:
            log(f"Failed to purchase access: {response.status_code}", "ERROR")
            try:
                error_data = response.json()
                log(f"   Error: {error_data.get('error', 'unknown')}", "ERROR")
            except:
                log(f"   Response: {response.text}", "ERROR")
            return False

    except requests.exceptions.Timeout:
        log("Request timed out", "ERROR")
        return False
    except Exception as e:
        log(f"Error purchasing access: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False


def scrape(url, auth_headers=None):
    """
    Attempt to scrape the URL with optional auth headers.
    Returns (success, content, status_code).
    """
    try:
        log(f"Scraping: {url}", "SCRAPE")

        # Merge BOT_HEADERS with auth_headers if provided
        headers = BOT_HEADERS.copy()
        if auth_headers:
            headers.update(auth_headers)
            log("Attached authentication headers (Zone ID & Secret)", "LOCK")

        response = requests.get(url, headers=headers, timeout=30)

        log(f"Status: {response.status_code}", "INFO")

        if response.status_code == 200:
            log(f"Success! Got {len(response.text)} characters", "SUCCESS")
            return True, response.text, 200
        elif response.status_code == 402:
            log("Payment required (402)", "PAYMENT")
            try:
                payment_info = response.json()
                return False, payment_info, 402
            except:
                return False, None, 402
        else:
            log(f"Failed with status {response.status_code}", "ERROR")
            return False, None, response.status_code

    except Exception as e:
        log(f"Error: {e}", "ERROR")
        return False, None, 0

def extract_client_ip(payment_info):
    """
    Extract client IP from payment info response.
    """
    if not payment_info:
        return None
    
    # Try different possible locations for IP
    ip = (payment_info.get('client_ip') or 
          payment_info.get('user_context', {}).get('ip') or
          payment_info.get('ip'))
    
    return ip

def extract_domain_from_url(url):
    """
    Extract domain from URL.
    Examples:
    - https://test-cloudflare-website.adarsh.software/ -> test-cloudflare-website.adarsh.software
    - https://www.example.com/path -> www.example.com
    """
    from urllib.parse import urlparse
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return None
    # Return the full hostname (including subdomain)
    return hostname

def list_available_projects():
    """
    List available projects from the bot-paywall main app API.
    Displays project IDs, domain names, and website URLs for easy selection.
    This endpoint fetches from: GET /api/projects/public (no auth required)
    """
    try:
        log("Fetching available projects from bot-paywall main app...", "INFO")

        # Try the public projects endpoint
        response = requests.get(
            f"{CONFIG['main_app_url']}/api/projects/public",
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            projects = data.get('projects', [])

            if not projects:
                log("No projects found in bot-paywall.", "INFO")
                return []

            print("\n" + "=" * 120)
            print("AVAILABLE PROJECTS IN BOT-PAYWALL")
            print("=" * 120)
            print(f"{'#':<4} {'Project ID':<40} {'Domain Name':<30} {'Website URL':<70}")
            print("-" * 120)

            for i, project in enumerate(projects, 1):
                project_id = project.get('id', 'N/A')
                domain = project.get('name', 'N/A')
                domain_display = project.get('domainName', domain)
                url = project.get('websiteUrl', 'N/A')

                # Truncate if too long
                url_display = (url[:67] + '...') if len(url) > 70 else url
                domain_display = (domain_display[:27] + '...') if len(domain_display) > 30 else domain_display

                print(f"{i:<4} {project_id:<40} {domain_display:<30} {url_display:<70}")

            print("-" * 120)
            print(f"Total: {len(projects)} project(s)")
            print()
            print("USAGE EXAMPLES:")
            print(f"  python scraper.py --project 1                      # Scrape 1st project by index")
            print(f"  python scraper.py --project example.com            # Scrape by domain name")
            print(f"  python scraper.py --project <project-id>           # Scrape by exact project ID")
            print()

            return projects
        else:
            log(f"Failed to fetch projects: {response.status_code}", "ERROR")
            log(f"Make sure bot-paywall main app is running at {CONFIG['main_app_url']}", "INFO")
            return []

    except Exception as e:
        log(f"Error fetching projects from bot-paywall: {e}", "ERROR")
        return []


def get_project_url(project_identifier):
    """
    Get the website URL for a project from bot-paywall.
    Supports multiple matching methods:
      - Index number: 1, 2, 3 (from --list-projects)
      - Domain name: example.com
      - Project ID: exact project ID from database
      - Partial match: partial domain name

    Args:
        project_identifier: Project index, domain, project ID, or URL
    Returns:
        The website URL or None if not found
    """
    try:
        # Fetch all projects from bot-paywall
        response = requests.get(
            f"{CONFIG['main_app_url']}/api/projects/public",
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            projects = data.get('projects', [])

            if not projects:
                log("No projects available in bot-paywall", "ERROR")
                return None

            # Method 1: Try to match by index number (1-based)
            if project_identifier.isdigit():
                idx = int(project_identifier) - 1
                if 0 <= idx < len(projects):
                    matched_project = projects[idx]
                    log(f"Matched project by index #{project_identifier}: {matched_project.get('name', 'Unknown')}", "INFO")
                    return matched_project.get('websiteUrl')
                else:
                    log(f"Project index {project_identifier} out of range (1-{len(projects)})", "ERROR")
                    return None

            # Method 2: Try to match by exact project ID
            for project in projects:
                if project.get('id', '').lower() == project_identifier.lower():
                    log(f"Matched project by ID: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            # Method 3: Try to match by exact domain name
            for project in projects:
                if (project.get('name', '').lower() == project_identifier.lower() or
                    project.get('domainName', '').lower() == project_identifier.lower()):
                    log(f"Matched project by domain: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            # Method 4: Try partial match on domain
            for project in projects:
                if project_identifier.lower() in project.get('name', '').lower():
                    log(f"Matched project by partial domain: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            # If no match found
            log(f"No matching project found for: {project_identifier}", "ERROR")
            return None

        # If API fails, try to construct URL directly
        if project_identifier.startswith('http'):
            log(f"Using provided URL directly: {project_identifier}", "INFO")
            return project_identifier
        else:
            # Assume it's a domain
            url = f"https://{project_identifier}"
            log(f"Constructing URL from domain: {url}", "INFO")
            return url

    except Exception as e:
        log(f"Error looking up project '{project_identifier}': {e}", "ERROR")
        # Fall back to treating identifier as domain
        if project_identifier.startswith('http'):
            return project_identifier
        return f"https://{project_identifier}"


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Simple Bot Scraper with x402 Payment Flow - Works with bot-paywall protected sites',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
    # List all projects from bot-paywall main app
    python scraper.py --list-projects

    # Scrape a project by index (from --list-projects output)
    python scraper.py --project 1

    # Scrape a project by domain name (must match exactly)
    python scraper.py --project example.com

    # Scrape a project by exact project ID
    python scraper.py --project 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p

    # Use a direct URL instead of looking up from bot-paywall
    python scraper.py --url https://example.com

    # Use custom access server
    python scraper.py --project 1 --access-server http://localhost:5000

ABOUT THIS SCRAPER:
    This scraper integrates with bot-paywall to handle websites protected by the x402 Payment Required
    protocol. It fetches your protected projects from the bot-paywall main app and handles all payment
    logic transparently.
        """
    )

    parser.add_argument(
        '--url', '-u',
        type=str,
        help='Direct website URL to scrape (bypasses bot-paywall project lookup)'
    )

    parser.add_argument(
        '--project', '-p',
        type=str,
        help='Bot-paywall project to scrape: by index (1,2...), domain name, or project ID'
    )

    parser.add_argument(
        '--list-projects', '-l',
        action='store_true',
        help='List all available projects from bot-paywall and exit'
    )

    parser.add_argument(
        '--access-server', '-a',
        type=str,
        default=CONFIG['access_server_url'],
        help=f"Access server URL (default: {CONFIG['access_server_url']})"
    )

    parser.add_argument(
        '--main-app', '-m',
        type=str,
        default=CONFIG['main_app_url'],
        help=f"Main app URL for project listing (default: {CONFIG['main_app_url']})"
    )

    parser.add_argument(
        '--wait-time', '-w',
        type=int,
        default=CONFIG['wait_after_payment'],
        help=f"Seconds to wait after payment (default: {CONFIG['wait_after_payment']})"
    )

    parser.add_argument(
        '--max-retries', '-r',
        type=int,
        default=CONFIG['max_retries'],
        help=f"Maximum retries for scraping (default: {CONFIG['max_retries']})"
    )

    return parser.parse_args()


# =============================================================================
# MAIN FLOW
# =============================================================================
def main():
    """Main scraping flow with x402 payment."""

    # Parse command line arguments
    args = parse_arguments()

    # Update CONFIG with command line arguments
    CONFIG['access_server_url'] = args.access_server
    CONFIG['main_app_url'] = args.main_app
    CONFIG['wait_after_payment'] = args.wait_time
    CONFIG['max_retries'] = args.max_retries

    # Configuration variables
    # Configuration variables
    auth_headers = None
    target_url = CONFIG['target_url']
    zone_id = None
    secret_key = None

    if args.url:
        target_url = args.url
        if not target_url.startswith('http'):
            target_url = 'https://' + target_url
    elif args.project:
        creds = get_project_credentials(args.project)
        if creds:
            target_url = creds['url']
            zone_id = creds['zone_id']
            secret_key = creds['secret_key']
            log(f"Resolved Project: {target_url}", "INFO")
        else:
            log(f"Could not resolve project: {args.project}", "ERROR")
            return 1



    CONFIG['target_url'] = target_url

    print("SIMPLE BOT SCRAPER - x402 Payment Flow")
    print("=" * 80)
    print(f"Target: {CONFIG['target_url']}")
    print(f"Access Server: {CONFIG['access_server_url']}")
    print("-" * 80)
    print()

    # =========================================================================
    # STEP 1: Try to scrape (should get 402)
    # =========================================================================
    print("STEP 1: Initial scrape attempt")
    print("-" * 40)

    success, content, status = scrape(CONFIG['target_url'], auth_headers)

    if success:
        log("Unexpected success - paywall not active?", "INFO")
        log("Saving content anyway...", "SAVE")
        with open('scraped_content.html', 'w') as f:
            f.write(content)
        log("Saved to scraped_content.html", "SUCCESS")
        return 0

    if status != 402:
        log("Expected 402 Payment Required, got different error", "ERROR")
        return 1

    log("As expected, got blocked (needs payment)", "INFO")

    # Extract the client IP from the 402 response
    client_ip = extract_client_ip(content)
    if client_ip:
        log(f"Detected client IP: {client_ip}", "INFO")
    else:
        log("Could not detect client IP from response", "ERROR")
        log("Will let access server detect it", "INFO")

    # Extract domain from target URL
    target_domain = extract_domain_from_url(CONFIG['target_url'])
    if not target_domain:
        log("Could not extract domain from target URL", "ERROR")
        return 1

    log(f"Extracted domain: {target_domain}", "INFO")

    print()

    # =========================================================================
    # STEP 2: Get payment information
    # =========================================================================
    print("STEP 2: Getting payment information")
    print("-" * 40)

    payment_info = get_payment_info()
    if payment_info:
        log("Payment details:", "INFO")
        log(f"   Amount: {payment_info.get('amount_move', 'unknown')} MOVE", "INFO")
        log(f"   Address: {payment_info.get('payment_address', 'unknown')}", "INFO")
        log(f"   Network: {payment_info.get('network', 'unknown')}", "INFO")

    print()

    # =========================================================================
    # STEP 3: Purchase access (x402 payment + whitelisting)
    # =========================================================================
    print("STEP 3: Purchasing access")
    print("-" * 40)

    access_granted = buy_access(client_ip, target_domain, zone_id, secret_key)

    if not access_granted:
        log("Access not granted - check access server logs", "ERROR")
        log("Make sure:", "INFO")
        log("  1. Access server is running", "INFO")
        log("  2. You have sufficient MOVE tokens", "INFO")
        log("  3. Your wallet is configured correctly", "INFO")
        return 1

    print()

    # =========================================================================
    # STEP 4: Wait for whitelisting to propagate
    # =========================================================================
    print("STEP 4: Waiting for whitelisting to propagate")
    print("-" * 40)

    wait_time = CONFIG['wait_after_payment']
    log(f"Waiting {wait_time} seconds...", "WAIT")
    time.sleep(wait_time)

    # Check access status
    if client_ip:
        is_whitelisted = check_access_status(client_ip, target_domain)
        if is_whitelisted:
            log(f"IP {client_ip} is now whitelisted", "SUCCESS")
        else:
            log(f"IP {client_ip} not yet whitelisted (may need more time)", "INFO")

    print()

    # =========================================================================
    # STEP 5: Retry scrape (should succeed)
    # =========================================================================
    print("STEP 5: Retry scraping")
    print("-" * 40)

    for attempt in range(1, CONFIG['max_retries'] + 1):
        log(f"Attempt {attempt}/{CONFIG['max_retries']}", "INFO")

        success, content, status = scrape(CONFIG['target_url'], auth_headers)

        if success:
            print()
            print("=" * 80)
            print("SUCCESS!")
            print("=" * 80)
            log(f"Content length: {len(content)} characters", "INFO")

            # Save to file
            with open('scraped_content.html', 'w', encoding='utf-8') as f:
                f.write(content)
            log("Saved to scraped_content.html", "SAVE")

            # Show preview
            print()
            print("Content preview (first 300 chars):")
            print("-" * 40)
            print(content[:300])
            print("-" * 40)

            return 0

        if attempt < CONFIG['max_retries']:
            log(f"Still blocked, waiting {CONFIG['retry_delay']} seconds before retry...", "WAIT")
            time.sleep(CONFIG['retry_delay'])

    print()
    log("Still blocked after all retries!", "ERROR")
    log("Possible issues:", "INFO")
    log("  - Whitelisting not propagated yet (wait longer)", "INFO")
    log("  - Cloudflare cache not cleared", "INFO")
    log("  - Wrong IP detected", "INFO")
    log("  - Access server issue", "INFO")

    return 1

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    try:
        exit_code = main()
        exit(exit_code)
    except KeyboardInterrupt:
        print("\n")
        log("Interrupted by user", "INFO")
        exit(1)
    except Exception as e:
        print("\n")
        log(f"Unexpected error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        exit(1)