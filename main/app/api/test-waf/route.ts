import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export async function POST(request: NextRequest) {
  try {
    const { zoneId, token, secretKey } = await request.json();

    if (!zoneId || !token || !secretKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: zoneId, token, secretKey' },
        { status: 400 }
      );
    }

    // Test the exact curl command format
    const rule = {
      description: 'Bypass Bot Fight Mode with Password',
      expression: `(http.request.headers["X-Bot-Auth"] eq "${secretKey}")`,
      action: 'skip',
      action_parameters: {
        phases: ['http_request_sbfm'],
      },
      enabled: true,
    };

    console.log('Testing WAF rule deployment...');
    console.log('Zone ID:', zoneId);
    console.log('Rule:', JSON.stringify(rule, null, 2));

    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/rules`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      }
    );

    const data = await response.json();

    console.log('Cloudflare Response Status:', response.status);
    console.log('Cloudflare Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Cloudflare API error',
          status: response.status,
          cloudflareResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'WAF rule deployed successfully',
      cloudflareResponse: data,
    });
  } catch (error) {
    console.error('Test WAF deployment error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Generate curl command for testing
export async function GET() {
  const exampleCurl = `
# Test WAF Rule Deployment
curl -X POST "http://localhost:3000/api/test-waf" \\
  -H "Content-Type: application/json" \\
  --data '{
    "zoneId": "YOUR_ZONE_ID",
    "token": "YOUR_CLOUDFLARE_TOKEN", 
    "secretKey": "gk_live_test123456789"
  }'

# Or test directly with Cloudflare API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/rulesets/phases/http_request_firewall_custom/rules" \\
  -H "Authorization: Bearer YOUR_CLOUDFLARE_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{
    "description": "Bypass Bot Fight Mode with Password",
    "expression": "(http.request.headers[\\"X-Bot-Auth\\"] eq \\"gk_live_test123456\\")",
    "action": "skip",
    "action_parameters": {
      "phases": ["http_request_sbfm"]
    },
    "enabled": true
  }'
`;

  return new Response(exampleCurl, {
    headers: { 'Content-Type': 'text/plain' },
  });
}