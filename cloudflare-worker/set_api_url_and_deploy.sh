#!/bin/bash

# Script to update API_BASE_URL in .env and deploy the worker
# Usage: ./set_api_url_and_deploy.sh <API_BASE_URL>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if API_BASE_URL argument is provided
if [ -z "$1" ]; then
    echo "Error: API_BASE_URL argument is required"
    echo "Usage: $0 <API_BASE_URL>"
    echo "Example: $0 https://api.example.com"
    exit 1
fi

API_BASE_URL="$1"

# Check if .env file exists, create if it doesn't
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    touch .env
fi

# Update or add API_BASE_URL in .env
if grep -q "^API_BASE_URL=" .env; then
    # Update existing entry
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^API_BASE_URL=.*|API_BASE_URL=$API_BASE_URL|" .env
    else
        # Linux
        sed -i "s|^API_BASE_URL=.*|API_BASE_URL=$API_BASE_URL|" .env
    fi
else
    # Add new entry
    echo "API_BASE_URL=$API_BASE_URL" >> .env
fi

echo "Updated .env with API_BASE_URL=$API_BASE_URL"

# Call the deploy script
./deploy_with_env.sh
