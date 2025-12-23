# Node.js Access Control Middleware

A "Pay-to-Pass" gateway that verifies Aptos blockchain payments and temporarily whitelists IP addresses on Cloudflare for exactly 60 seconds.

## Features

- **Blockchain Payment Verification**: Validates Aptos/Movement blockchain transactions
- **Temporary Access Control**: Grants 60-second IP-based access via Cloudflare firewall rules
- **Automatic Cleanup**: Timer-based rule expiration and cleanup
- **RESTful API**: Simple POST endpoint for access requests
- **Comprehensive Logging**: Full audit trail of all operations

## Installation

```bash
npm install
```

## Configuration

The server uses the following configuration constants (defined in access-server.js):

- `CLOUDFLARE_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ZONE_ID`: Target Cloudflare zone ID
- `PAYMENT_DESTINATION`: Wallet address for payment verification
- `REQUIRED_AMOUNT_OCTAS`: Minimum payment amount (1,000,000 Octas = 0.01 MOVE)
- `SUBSCRIPTION_DURATION_MS`: Access duration (60,000ms = 60 seconds)

## Usage

### Start the server

```bash
npm start
```

The server will listen on port 3000.

### Request Access

Send a POST request to `/buy-access`:

```bash
curl -X POST http://localhost:3000/buy-access \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "0x1234567890abcdef...",
    "scraper_ip": "192.168.1.100"
  }'
```

**Parameters:**
- `tx_hash` (required): Aptos transaction hash for payment verification
- `scraper_ip` (optional): IP address to whitelist (auto-detected if not provided)

**Success Response:**
```json
{
  "status": "granted",
  "expires_in": "60s"
}
```

## API Endpoints

### POST /buy-access

Verifies payment and grants temporary access.

**Request Body:**
```json
{
  "tx_hash": "string",
  "scraper_ip": "string (optional)"
}
```

**Responses:**
- `200 OK`: Access granted
- `402 Payment Required`: Invalid or insufficient payment
- `500 Internal Server Error`: System error

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

The system consists of three main components:

1. **Payment Verifier**: Validates Aptos blockchain transactions
2. **Cloudflare Client**: Manages firewall rules via Cloudflare API
3. **Timer Manager**: Handles automatic cleanup and timer management

## License

MIT