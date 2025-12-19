#!/bin/bash

# Delete whitelist rule for webscraper IP
ZONE_ID="11685346bf13dc3ffebc9cc2866a8105"
API_TOKEN="oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
WEBSCRAPER_IP="210.212.2.133"

echo "🔒 Deleting whitelist rule for IP: $WEBSCRAPER_IP"

RULE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules?configuration.value=$WEBSCRAPER_IP" -H "Authorization: Bearer $API_TOKEN" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result'][0]['id'] if data['result'] else '')")

if [ ! -z "$RULE_ID" ]; then
    echo "🗑️  Deleting rule: $RULE_ID"
    curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules/$RULE_ID" \
    -H "Authorization: Bearer $API_TOKEN"
    echo ""
    echo "✅ Whitelist rule deleted! Webscraper should now be blocked."
else
    echo "ℹ️  No whitelist rule found for IP: $WEBSCRAPER_IP"
fi