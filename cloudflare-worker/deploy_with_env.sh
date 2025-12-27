#!/bin/bash

# Deploy Cloudflare Worker with environment variables
# This script reads .env file and sets up worker configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "�� Deploying Cloudflare Worker with environment variables"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Load .env file
set -a
source .env
set +a

# List of secret variables (should be set as secrets in Cloudflare)
SECRETS=(
    "WORKER_API_KEY"
)

# List of regular variables (set as environment variables)
VARS=(
    "API_BASE_URL"
)

echo "📝 Processing environment variables..."

# Process regular variables
for var in "${VARS[@]}"; do
    if [ -n "${!var}" ]; then
        echo "Setting var: $var"
        echo "Note: Ensure $var is set in wrangler.toml under [vars] section or use wrangler vars"
    else
        echo "⚠️  Warning: $var is not set in .env"
    fi
done

# Read .env and filter variables
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    
    # Remove surrounding quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    # Check if this is a secret variable
    is_secret=false
    for secret in "${SECRETS[@]}"; do
        if [ "$key" = "$secret" ]; then
            is_secret=true
            break
        fi
    done
    
    # Check if this is a regular variable
    is_var=false
    for var in "${VARS[@]}"; do
        if [ "$key" = "$var" ]; then
            is_var=true
            break
        fi
    done
    
    if [ "$is_secret" = true ]; then
        echo "Setting secret: $key"
        # Use printf instead of echo to avoid exposing secrets in process lists
        printf "%s" "$value" | npx wrangler secret put "$key"
    elif [ "$is_var" = true ]; then
        echo "Setting variable: $key=$value"
        npx wrangler secret put "$key" --env production 2>/dev/null || \
        echo "Note: Variable $key should be set in wrangler.toml under [vars] section"
    else
        echo "Ignoring .env key not in secret/vars lists: $key"
    fi
done < .env

echo ""
echo "✅ Environment configuration complete"
echo "🚀 Deploying worker..."

# Deploy the worker
npx wrangler deploy
DEPLOY_EXIT_CODE=$?

# Fixed: properly quoted echo statement
echo "Deployment completed (check dashboard for status)"

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "${GREEN}✅ Deployment successful!${NC}"
else
    echo ""
    echo "${RED}❌ Deployment failed${NC}"
    exit 1
fi
