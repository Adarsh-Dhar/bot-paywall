#!/bin/bash

# Create whitelist rule for webscraper IP
ZONE_ID="11685346bf13dc3ffebc9cc2866a8105"
API_TOKEN="oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
WEBSCRAPER_IP="210.212.2.133"

echo "🔓 Creating whitelist rule for IP: $WEBSCRAPER_IP"

RULE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules?configuration.value=$WEBSCRAPER_IP" -H "Authorization: Bearer $API_TOKEN" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result'][0]['id'] if data['result'] else '')")

if [ ! -z "$RULE_ID" ]; then
    echo "⚠️  Existing rule found: $RULE_ID - Deleting first..."
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules/$RULE_ID" -H "Authorization: Bearer $API_TOKEN"
fi

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules" \
-H "Authorization: Bearer $API_TOKEN" \
-H "Content-Type: application/json" \
--data '{"mode":"whitelist","configuration":{"target":"ip","value":"'$WEBSCRAPER_IP'"},"notes":"Bypass"}'

echo ""
echo "✅ Whitelist rule created! Webscraper should now be able to access the site."