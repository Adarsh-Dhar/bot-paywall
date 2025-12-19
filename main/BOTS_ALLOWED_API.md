# Bots Allowed API Documentation

This API allows you to manage a list of IP addresses that are allowed to bypass bot protection.

## ⚠️ Auto-Expiry Feature

**All IP addresses are automatically removed after 1 minute for security purposes.**

- IPs are checked every 10 seconds for expiry
- Any IP older than 1 minute is automatically deleted
- This ensures temporary access without manual cleanup

## Database Schema

The `BotsAllowed` model in the database contains:
- `id`: Unique identifier (string)
- `ipAddress`: IP address (string, unique)
- `reason`: Optional reason for allowing this IP (string, optional)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Additional fields in API responses:**
- `timeRemaining`: Milliseconds until the IP expires (number)
- `isExpired`: Whether the IP has already expired (boolean)

## API Endpoints

### GET /api/bots-allowed
List all allowed bot IP addresses.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123...",
      "ipAddress": "192.168.1.100",
      "reason": "Development bot",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "timeRemaining": 45000,
      "isExpired": false
    }
  ]
}
```

### POST /api/bots-allowed
Add a new IP address to the allowed list.

**Request Body:**
```json
{
  "ipAddress": "192.168.1.100",
  "reason": "Optional reason for allowing this IP"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "ipAddress": "192.168.1.100",
    "reason": "Optional reason for allowing this IP",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "timeRemaining": 60000,
    "isExpired": false
  },
  "message": "Bot IP added to allowed list successfully (will auto-expire in 1 minute)"
}
```

**Response (Error - Duplicate IP):**
```json
{
  "success": false,
  "error": "IP address already exists in allowed list"
}
```

**Response (Error - Invalid IP):**
```json
{
  "success": false,
  "error": "Invalid input data",
  "details": [
    {
      "code": "custom",
      "message": "Invalid IP address format",
      "path": ["ipAddress"]
    }
  ]
}
```

### DELETE /api/bots-allowed
Remove an IP address from the allowed list.

**Request Body:**
```json
{
  "ipAddress": "192.168.1.100"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Bot IP removed from allowed list successfully"
}
```

**Response (Error - Not Found):**
```json
{
  "success": false,
  "error": "IP address not found in allowed list"
}
```

### GET /api/bots-allowed/cleanup
Get cleanup service status.

**Response:**
```json
{
  "success": true,
  "status": "Cleanup service is running",
  "checkInterval": "10 seconds",
  "expiryTime": "1 minute"
}
```

### POST /api/bots-allowed/cleanup
Manually trigger cleanup of expired IP addresses.

**Response:**
```json
{
  "success": true,
  "message": "Cleaned up 2 expired bot IP(s)",
  "cleanedCount": 2
}
```

## Usage Examples

### Using curl

```bash
# List all allowed IPs
curl http://localhost:3000/api/bots-allowed

# Add a new IP
curl -X POST http://localhost:3000/api/bots-allowed \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.100", "reason": "Development bot"}'

# Remove an IP
curl -X DELETE http://localhost:3000/api/bots-allowed \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.100"}'
```

### Using JavaScript/fetch

```javascript
// List all allowed IPs
const response = await fetch('/api/bots-allowed');
const result = await response.json();

// Add a new IP
const addResponse = await fetch('/api/bots-allowed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ipAddress: '192.168.1.100',
    reason: 'Development bot'
  })
});

// Remove an IP
const deleteResponse = await fetch('/api/bots-allowed', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ipAddress: '192.168.1.100'
  })
});
```

## Web Interface

A web interface is available at `/bots-allowed` where you can:
- View all allowed bot IPs
- Add new IP addresses with optional reasons
- Remove existing IP addresses
- See when each IP was added

## Validation

- IP addresses must be valid IPv4 format (e.g., 192.168.1.100)
- IP addresses must be unique in the database
- Reason field is optional but recommended for documentation

## Error Handling

All endpoints return consistent error responses with:
- `success: false`
- `error`: Human-readable error message
- `details`: Additional validation details (when applicable)

HTTP status codes:
- 200: Success
- 400: Bad request (validation errors)
- 404: Not found (for DELETE operations)
- 409: Conflict (duplicate IP address)
- 500: Internal server error