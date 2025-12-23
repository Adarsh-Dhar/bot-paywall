// Simple test worker to debug the issue
export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const transactionId = request.headers.get("X402-Transaction-ID");
    
    // Simple response with debug info
    const response = {
      message: "Test worker is running",
      client_ip: clientIP,
      transaction_id: transactionId,
      user_agent: request.headers.get("User-Agent"),
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Client-IP": clientIP,
        "X-Debug-Transaction-ID": transactionId || "none"
      }
    });
  }
};