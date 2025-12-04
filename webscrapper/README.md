# Movement x402 Webscraper

This is a standalone Python scraper that can negotiate HTTP `402 Payment Required` paywalls
by sending on-chain payments over Movement's EVM-compatible layer (MEVM) and retrying the
request with a payment proof.

## Features

- Detects `402 Payment Required` responses from x402-enabled endpoints.
- Parses payment instructions from the 402 response body (JSON).
- Sends a payment transaction on Movement MEVM using `web3.py`.
- Retries the original request with a payment proof in the headers.

## Requirements

- Python 3.9+
- A Movement MEVM RPC endpoint.
- A funded private key on the target Movement network (for gas and payment).

Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

The scraper reads its configuration from environment variables. For local
development you can create a `.env` file in the `webscrapper` directory:

```bash
cd webscrapper
cp .env.example .env  # after you create it
```

Required variables:

- `MOVEMENT_RPC_URL` – HTTP RPC endpoint for Movement's EVM-compatible network (MEVM),
  for example: `https://mevm.devnet.m1.movementlabs.xyz`.
- `MOVEMENT_PRIVATE_KEY` – Hex-encoded private key for the wallet that will
  pay the x402 invoices (keep this secret).

> Note: `.env` is ignored by git so that secrets are not committed.

## Usage

From the `webscrapper` directory:

```bash
python main.py https://api.example-x402-service.com/premium-data
```

What happens:

- The script loads `MOVEMENT_RPC_URL` and `MOVEMENT_PRIVATE_KEY`.
- It sends a GET request to the target URL.
- If the server responds with `200 OK`, the content is printed to stdout.
- If the server responds with `402 Payment Required` and a JSON body like:

  ```json
  { "receiver": "0xRecipientAddress", "price": 1000000000000000000 }
  ```

  the scraper:

  - sends an on-chain payment transaction on Movement MEVM to `receiver`
    for `price` wei,
  - waits for 1 confirmation,
  - retries the request with the transaction hash in `X-Payment-Hash` and
    `Authorization` headers.

If access is granted after payment (`200 OK`), the response body is printed to
stdout so you can pipe or redirect it.


