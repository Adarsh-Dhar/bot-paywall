"""
Main client module for BotPaywall SDK.

Provides the primary interface for interacting with bot-paywall services.
"""

import time
from typing import Optional, Dict, Any, List

import requests

from .config import BotPaywallConfig
from .payment import PaymentClient
from .utils import log, extract_domain_from_url
import os


class BotPaywallClient:
    """
    Main client for BotPaywall SDK.

    Provides methods for:
    - Project management (list, lookup, get credentials)
    - Payment handling (x402 flow)
    - Access management (buy access, check whitelist status)

    Example:
        >>> client = BotPaywallClient(
        ...     access_server_url=process.env.ACCESS_SERVER_URL,
        ...     private_key="your_private_key"
        ... )
        >>> project = client.get_project_credentials("example.com")
        >>> result = client.buy_access(
        ...     domain="example.com",
        ...     zone_id=project['zone_id'],
        ...     secret_key=project['secret_key']
        ... )
    """

    def __init__(
        self,
        access_server_url: str = "http://localhost:5000",
        main_app_url: str = "http://localhost:3000",
        private_key: Optional[str] = None,
        wait_after_payment: int = 10,
        max_retries: int = 3,
        retry_delay: int = 5,
        **kwargs
    ):
        """
        Initialize the BotPaywall client.

        Args:
            access_server_url: URL of the access server handling x402 payments
            main_app_url: URL of the main bot-paywall app
            private_key: Private key for blockchain payments
            wait_after_payment: Seconds to wait after payment for propagation
            max_retries: Maximum retry attempts
            retry_delay: Seconds between retries
            **kwargs: Additional configuration options
        """
        self.config = BotPaywallConfig(
            access_server_url=access_server_url,
            main_app_url=main_app_url,
            private_key=private_key,
            wait_after_payment=wait_after_payment,
            max_retries=max_retries,
            retry_delay=retry_delay,
        )
        self.config.update(**kwargs)

        self.payment_client = PaymentClient(self.config)

    # =========================================================================
    # Project Management
    # =========================================================================

    def get_project_credentials(self, project_url_or_domain: str) -> Optional[Dict[str, Any]]:
        """
        Fetch project credentials from the main app.

        Returns zone_id and secret_key needed for Cloudflare whitelisting.

        Args:
            project_url_or_domain: URL or domain name of the project

        Returns:
            Dict with 'url', 'zone_id', 'secret_key' or None if not found
        """
        try:
            if project_url_or_domain.startswith('http'):
                domain = extract_domain_from_url(project_url_or_domain)
            else:
                domain = project_url_or_domain

            if not domain:
                log(f"Could not extract domain from: {project_url_or_domain}", "ERROR")
                return None

            url = f"{self.config.main_app_url}/api/projects/public?domain={domain}"

            log(f"Fetching credentials for domain {domain}...", "INFO")
            response = requests.get(url, timeout=self.config.request_timeout)

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
                log(f"Project not found for domain: {domain}", "ERROR")
                return None
            else:
                log(f"Failed to fetch project credentials: {response.status_code}", "ERROR")
                return None

        except Exception as e:
            log(f"Error fetching credentials: {e}", "ERROR")
            return None

    def list_projects(self, print_table: bool = True) -> List[Dict[str, Any]]:
        """
        List available projects from the bot-paywall main app.

        Args:
            print_table: If True, print a formatted table of projects

        Returns:
            List of project dictionaries
        """
        try:
            log("Fetching available projects from bot-paywall main app...", "INFO")

            response = requests.get(
                f"{self.config.main_app_url}/api/projects/public",
                timeout=self.config.request_timeout
            )

            if response.status_code == 200:
                data = response.json()
                projects = data.get('projects', [])

                if not projects:
                    log("No projects found in bot-paywall.", "INFO")
                    return []

                if print_table:
                    self._print_projects_table(projects)

                return projects
            else:
                log(f"Failed to fetch projects: {response.status_code}", "ERROR")
                return []

        except Exception as e:
            log(f"Error fetching projects: {e}", "ERROR")
            return []

    def _print_projects_table(self, projects: List[Dict[str, Any]]) -> None:
        """Print a formatted table of projects."""
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

            url_display = (url[:67] + '...') if len(url) > 70 else url
            domain_display = (domain_display[:27] + '...') if len(domain_display) > 30 else domain_display

            print(f"{i:<4} {project_id:<40} {domain_display:<30} {url_display:<70}")

        print("-" * 120)
        print(f"Total: {len(projects)} project(s)")
        print()

    def get_project_url(self, project_identifier: str) -> Optional[str]:
        """
        Get the website URL for a project.

        Supports multiple matching methods:
        - Index number: 1, 2, 3
        - Domain name: example.com
        - Project ID: exact project ID
        - Partial match: partial domain name

        Args:
            project_identifier: Project index, domain, or ID

        Returns:
            The website URL or None if not found
        """
        try:
            response = requests.get(
                f"{self.config.main_app_url}/api/projects/public",
                timeout=self.config.request_timeout
            )

            if response.status_code != 200:
                if project_identifier.startswith('http'):
                    return project_identifier
                return f"https://{project_identifier}"

            data = response.json()
            projects = data.get('projects', [])

            if not projects:
                log("No projects available in bot-paywall", "ERROR")
                return None

            # Method 1: Match by index number (1-based)
            if project_identifier.isdigit():
                idx = int(project_identifier) - 1
                if 0 <= idx < len(projects):
                    matched = projects[idx]
                    log(f"Matched project by index #{project_identifier}: {matched.get('name', 'Unknown')}", "INFO")
                    return matched.get('websiteUrl')
                else:
                    log(f"Project index {project_identifier} out of range (1-{len(projects)})", "ERROR")
                    return None

            # Method 2: Match by exact project ID
            for project in projects:
                if project.get('id', '').lower() == project_identifier.lower():
                    log(f"Matched project by ID: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            # Method 3: Match by exact domain name
            for project in projects:
                if (project.get('name', '').lower() == project_identifier.lower() or
                    project.get('domainName', '').lower() == project_identifier.lower()):
                    log(f"Matched project by domain: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            # Method 4: Partial match on domain
            for project in projects:
                if project_identifier.lower() in project.get('name', '').lower():
                    log(f"Matched project by partial domain: {project.get('name', 'Unknown')}", "INFO")
                    return project.get('websiteUrl')

            log(f"No matching project found for: {project_identifier}", "ERROR")
            return None

        except Exception as e:
            log(f"Error looking up project '{project_identifier}': {e}", "ERROR")
            if project_identifier.startswith('http'):
                return project_identifier
            return f"https://{project_identifier}"

    # =========================================================================
    # Access Management
    # =========================================================================

    def detect_public_ip(self) -> Optional[str]:
        """
        Detect your public IP address.

        Returns:
            Public IP address or None if detection fails
        """
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=5)
            if response.status_code == 200:
                ip = response.json().get('ip')
                log(f"Detected public IP: {ip}", "INFO")
                return ip
        except Exception as e:
            log(f"Could not fetch public IP: {e}", "INFO")
        return None

    def check_access_status(self, ip: str, domain: str) -> bool:
        """
        Check if an IP is whitelisted for a domain.

        Args:
            ip: The IP address to check
            domain: The domain name

        Returns:
            True if whitelisted, False otherwise
        """
        try:
            response = requests.get(
                f"{self.config.access_server_url}/check-access/{ip}",
                params={'domain': domain},
                timeout=self.config.request_timeout
            )

            if response.status_code == 200:
                data = response.json()
                return data.get('whitelisted', False)

            return False

        except Exception as e:
            log(f"Error checking access status: {e}", "ERROR")
            return False

    def get_payment_info(self) -> Optional[Dict[str, Any]]:
        """
        Get payment information from access server.

        Returns:
            Payment info dictionary or None
        """
        return self.payment_client.get_payment_info()

    def buy_access(
        self,
        domain: str,
        zone_id: Optional[str] = None,
        secret_key: Optional[str] = None,
        scraper_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Purchase access for a scraper IP.

        Handles the full x402 payment flow:
        1. Request access (receives 402 with payment instructions)
        2. Make blockchain payment
        3. Retry with payment proof

        Args:
            domain: The domain name to access
            zone_id: Cloudflare Zone ID (required for whitelisting)
            secret_key: Cloudflare API token (required for whitelisting)
            scraper_ip: IP to whitelist (auto-detected if not provided)

        Returns:
            Dict with 'success' boolean and additional info
        """
        try:
            if not scraper_ip:
                scraper_ip = self.detect_public_ip()

            if not scraper_ip:
                return {'success': False, 'error': 'Could not detect scraper IP'}

            payload = {
                'scraper_ip': scraper_ip,
                'domain': domain
            }

            if zone_id and secret_key:
                payload['zone_id'] = zone_id
                payload['secret_key'] = secret_key
                log(f"Using Cloudflare credentials for zone: {zone_id[:20]}...", "INFO")
            else:
                log("WARNING: No Cloudflare credentials provided - whitelisting may fail", "ERROR")

            response = requests.post(
                f"{self.config.access_server_url}/buy-access",
                json=payload,
                timeout=120
            )

            if response.status_code == 402:
                payment_data = response.json()
                tx_hash = self.payment_client.process_402_payment(payment_data)

                if not tx_hash:
                    return {'success': False, 'error': 'Payment failed'}

                retry_payload = {
                    'scraper_ip': scraper_ip,
                    'domain': domain,
                    'tx_hash': tx_hash
                }

                if zone_id and secret_key:
                    retry_payload['zone_id'] = zone_id
                    retry_payload['secret_key'] = secret_key

                log(f"Retrying request with payment proof: {tx_hash}", "INFO")
                response = requests.post(
                    f"{self.config.access_server_url}/buy-access",
                    json=retry_payload,
                    headers={
                        'X-PAYMENT-PROOF': tx_hash,
                        'X-Payment-Proof': tx_hash,
                        'X-Payment-Hash': tx_hash
                    },
                    timeout=120
                )

            if response.status_code == 200:
                data = response.json()
                log("Access granted!", "SUCCESS")
                log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
                log(f"   Status: {data.get('status', 'unknown')}", "INFO")

                if 'rule_id' in data:
                    log(f"   Cloudflare Rule ID: {data['rule_id']}", "SUCCESS")

                return {
                    'success': True,
                    'ip': data.get('ip'),
                    'status': data.get('status'),
                    'rule_id': data.get('rule_id'),
                    'transaction': data.get('transaction')
                }
            else:
                error_msg = f"Failed to purchase access: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                log(error_msg, "ERROR")
                return {'success': False, 'error': error_msg}

        except requests.exceptions.Timeout:
            log("Request timed out", "ERROR")
            return {'success': False, 'error': 'Request timed out'}
        except Exception as e:
            log(f"Error purchasing access: {e}", "ERROR")
            return {'success': False, 'error': str(e)}

    def wait_for_propagation(self, seconds: Optional[int] = None) -> None:
        """
        Wait for Cloudflare whitelist rule to propagate.

        Args:
            seconds: Seconds to wait (uses config default if not specified)
        """
        wait_time = seconds or self.config.wait_after_payment
        log(f"Waiting {wait_time} seconds for Cloudflare to propagate the whitelist rule...", "WAIT")
        time.sleep(wait_time)
