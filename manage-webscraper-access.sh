#!/bin/bash

# Cloudflare API Configuration
ZONE_ID="11685346bf13dc3ffebc9cc2866a8105"
API_TOKEN="oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
WEBSCRAPER_IP="210.212.2.133"

# Function to add IP to whitelist
add_ip_whitelist() {
    echo "🔓 Adding IP $WEBSCRAPER_IP to Cloudflare whitelist..."
    
    # Add Cloudflare firewall rule
    RULE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"mode\":\"whitelist\",\"configuration\":{\"target\":\"ip\",\"value\":\"$WEBSCRAPER_IP\"},\"notes\":\"Webscraper IP bypass\"}")
    
    if echo "$RULE_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Cloudflare firewall rule created successfully"
    else
        echo "❌ Failed to create Cloudflare firewall rule"
        echo "$RULE_RESPONSE"
        exit 1
    fi
    
    # Update Worker environment variable
    cd cloudflare-worker
    sed -i '' 's/WHITELISTED_IPS = ""/WHITELISTED_IPS = "'$WEBSCRAPER_IP'"/' wrangler.toml
    
    echo "🚀 Deploying updated Cloudflare Worker..."
    npx wrangler deploy
    
    if [ $? -eq 0 ]; then
        echo "✅ Webscraper access ENABLED"
    else
        echo "❌ Failed to deploy Worker"
        exit 1
    fi
}

# Function to remove IP from whitelist
remove_ip_whitelist() {
    echo "🔒 Removing IP $WEBSCRAPER_IP from Cloudflare whitelist..."
    
    # Get existing rule ID
    RULE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules?configuration.value=$WEBSCRAPER_IP" \
        -H "Authorization: Bearer $API_TOKEN" | \
        python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result'][0]['id'] if data['result'] else '')")
    
    # Delete firewall rule if it exists
    if [ ! -z "$RULE_ID" ]; then
        DELETE_RESPONSE=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/access_rules/rules/$RULE_ID" \
            -H "Authorization: Bearer $API_TOKEN")
        
        if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
            echo "✅ Cloudflare firewall rule deleted successfully"
        else
            echo "❌ Failed to delete Cloudflare firewall rule"
            echo "$DELETE_RESPONSE"
        fi
    else
        echo "ℹ️  No existing firewall rule found"
    fi
    
    # Update Worker environment variable
    cd cloudflare-worker
    sed -i '' 's/WHITELISTED_IPS = "'$WEBSCRAPER_IP'"/WHITELISTED_IPS = ""/' wrangler.toml
    
    echo "🚀 Deploying updated Cloudflare Worker..."
    npx wrangler deploy
    
    if [ $? -eq 0 ]; then
        echo "✅ Webscraper access DISABLED"
    else
        echo "❌ Failed to deploy Worker"
        exit 1
    fi
}

# Function to test webscraper
test_webscraper() {
    echo "🧪 Testing webscraper access..."
    cd webscrapper
    python main.py
}

# Main script logic
case "$1" in
    "enable")
        add_ip_whitelist
        ;;
    "disable")
        remove_ip_whitelist
        ;;
    "test")
        test_webscraper
        ;;
    *)
        echo "Usage: $0 {enable|disable|test}"
        echo ""
        echo "Commands:"
        echo "  enable  - Add webscraper IP to whitelist (allows bot access)"
        echo "  disable - Remove webscraper IP from whitelist (blocks bot access)"
        echo "  test    - Test current webscraper access"
        exit 1
        ;;
esac