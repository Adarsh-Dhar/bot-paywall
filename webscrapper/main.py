import argparse
import os
import sys

from dotenv import load_dotenv

from movement_x402_scraper import MovementX402Scraper


def load_env() -> tuple[str, str]:
    """
    Load required environment variables for the Movement x402 scraper.

    Expected variables:
      - MOVEMENT_RPC_URL: HTTP RPC endpoint for Movement's MEVM.
      - MOVEMENT_PRIVATE_KEY: Hex-encoded private key for the paying wallet.
    """
    # Load variables from a .env file if present (local development)
    load_dotenv()

    rpc_url = os.getenv("MOVEMENT_RPC_URL")
    private_key = os.getenv("MOVEMENT_PRIVATE_KEY")

    missing = []
    if not rpc_url:
        missing.append("MOVEMENT_RPC_URL")
    if not private_key:
        missing.append("MOVEMENT_PRIVATE_KEY")

    if missing:
        missing_str = ", ".join(missing)
        msg = (
            f"Missing required environment variable(s): {missing_str}. "
            "Create a .env file next to this script or export them in your shell."
        )
        print(msg, file=sys.stderr)
        sys.exit(1)

    return rpc_url, private_key


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Movement x402-enabled web scraper.\n"
            "Performs a GET request against a URL, pays an on-chain fee on Movement "
            "if the server returns HTTP 402, and retries with a payment proof."
        )
    )
    parser.add_argument(
        "url",
        help="Target URL to scrape (must support x402 for paid access).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv or sys.argv[1:])

    rpc_url, private_key = load_env()

    try:
        scraper = MovementX402Scraper(rpc_url, private_key)
    except Exception as exc:
        print(f"Failed to initialize scraper: {exc}", file=sys.stderr)
        sys.exit(1)

    content = scraper.scrape(args.url)

    if content is None:
        print("Scrape failed or access denied after payment.", file=sys.stderr)
        sys.exit(1)

    # Print the fetched content to stdout so it can be piped or redirected.
    print(content)


if __name__ == "__main__":
    main()



