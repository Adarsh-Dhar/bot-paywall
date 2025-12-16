# Cloudflare Worker Authentication Setup

## The Problem
You're getting authentication errors because either:
1. Your API token is invalid/expired
2. Your account ID is missing or incorrect
3. You have conflicting authentication methods

## Solution Steps

### Step 1: Clear existing authentication
```bash
# Remove any API token from environment
unset CLOUDFLARE_API_TOKEN

# Check if it's in your .env file and remove it
# Edit cloudflare-worker/.env and remove CLOUDFLARE_API_TOKEN line if present

# Logout from wrangler
wrangler logout --force
```

### Step 2: Get your Account ID
1. Go to https://dash.cloudflare.com/
2. On the right sidebar, you'll see your Account ID
3. Copy this Account ID

### Step 3: Update wrangler.toml
Add your account ID to `cloudflare-worker/wrangler.toml`:
```toml
account_id = "your_actual_account_id_here"
```

### Step 4: Login via OAuth (Recommended)
```bash
wrangler login
```
This will open your browser for OAuth authentication.

### Step 5: Alternative - Use API Token
If OAuth doesn't work, create a new API token:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Cloudflare Workers:Edit" template
4. Set the token:
```bash
export CLOUDFLARE_API_TOKEN=your_new_token_here
```

### Step 6: Test authentication
```bash
wrangler whoami
```

### Step 7: Deploy
```bash
wrangler deploy
```

## Common Issues
- **Account ID not found**: Make sure you're using the correct Account ID from your Cloudflare dashboard
- **KV namespace error**: The KV namespace ID might be invalid. Create a new one in Cloudflare dashboard
- **Permission denied**: Make sure your API token has "Cloudflare Workers:Edit" permissions