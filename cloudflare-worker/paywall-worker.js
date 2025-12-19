// CLOUDFLARE WORKER CODE (The Gatekeeper) - NO PASSWORD MODE
// This worker acts as a proxy, forwarding all requests to the origin server

// Configuration from environment variables
function getConfig(env) {
  return {
    logging: env?.LOGGING === "true",
    originUrl: env?.ORIGIN_URL || "https://test-paywall-website.adarsh.software"
  };
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.logging) {
      console.log("Proxy worker processing request", {
        url: request.url,
        method: request.method,
        origin: config.originUrl
      });
    }
    
    // Forward all requests to the origin server without authentication
    if (config.logging) {
      console.log("Forwarding request to origin");
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



