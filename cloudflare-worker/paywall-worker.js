// CLOUDFLARE WORKER CODE (The Gatekeeper) - PASSWORD MODE
// This worker acts as a gatekeeper, forwarding authenticated requests to the origin server

// Password configuration from environment variables
function getConfig(env) {
  return {
    password: env?.ACCESS_PASSWORD || "secret123",
    logging: env?.LOGGING === "true",
    originUrl: env?.ORIGIN_URL || "https://test-paywall-website.adarsh.software"
  };
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.logging) {
      console.log("Gatekeeper worker processing request", {
        url: request.url,
        method: request.method,
        origin: config.originUrl
      });
    }
    
    // 1. Check if the user provided the password
    const providedPassword = request.headers.get("X-Access-Password");

    if (!providedPassword || providedPassword !== config.password) {
      // NO PASSWORD OR WRONG PASSWORD -> Return 401
      if (config.logging) {
        console.log("Authentication failed - no password or incorrect password");
      }
      
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Please provide the correct access password in the X-Access-Password header."
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. PASSWORD MATCHES -> Forward the request to the origin server
    if (config.logging) {
      console.log("Password verified successfully - forwarding to origin");
    }
    
    // Create a new request to the origin server
    const originRequest = new Request(config.originUrl + new URL(request.url).pathname + new URL(request.url).search, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // Forward the request and return the response
    return fetch(originRequest);
  },
};



