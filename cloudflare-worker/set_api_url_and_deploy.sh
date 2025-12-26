#!/usr/bin/env bash
# Usage: ./set_api_url_and_deploy.sh https://abcd-1234.ngrok-free.app
# This script updates ./cloudflare-worker/.env with API_BASE_URL and calls deploy_with_env.sh
set -euo pipefail
cd "$(dirname "$0")"
PUBLIC_URL="${1:-}"
if [[ -z "$PUBLIC_URL" ]]; then
  echo "Error: public API base URL required as first argument. Example: ./set_api_url_and_deploy.sh https://abcd.ngrok.io"
  exit 1
fi
if ! [[ "$PUBLIC_URL" =~ ^https?:// ]]; then
  echo "Error: API base URL must start with http:// or https://"
  exit 1
fi
ENV_FILE=".env"
# Ensure file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Creating $ENV_FILE"
  touch "$ENV_FILE"
fi
# Remove existing API_BASE_URL or API_URL lines robustly using awk (case-insensitive)
awk 'BEGIN{IGNORECASE=1} !/^\s*(API_BASE_URL|API_URL)\s*=/' "$ENV_FILE" > "$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"

# Append new API_BASE_URL
printf "\n# Public API base URL for worker to fetch config (set by set_api_url_and_deploy.sh)\nAPI_BASE_URL=%s\n" "$PUBLIC_URL" >> "$ENV_FILE"

echo "Updated $ENV_FILE with API_BASE_URL=$PUBLIC_URL"

# Run deploy helper
if [[ ! -x "deploy_with_env.sh" ]]; then
  chmod +x deploy_with_env.sh || true
fi
./deploy_with_env.sh

echo "Done. If deployment succeeded, run 'npx wrangler tail' to watch logs."
