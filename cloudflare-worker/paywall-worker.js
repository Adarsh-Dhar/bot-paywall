// CLOUDFLARE WORKER CODE (The Gatekeeper) - PASSWORD MODE
// This worker intercepts requests at the edge and checks for password authentication

// Password configuration from environment variables
function getConfig(env) {
  return {
    password: env?.ACCESS_PASSWORD || "secret123",
    logging: env?.LOGGING === "true"
  };
}

export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    
    if (config.logging) {
      console.log("Password worker processing request", {
        url: request.url,
        method: request.method
      });
    }
    
    // 1. Check if the user provided the password
    const providedPassword = request.headers.get("X-Access-Password");

    if (!providedPassword) {
      // NO PASSWORD? -> Return 401 with instructions
      return new Response(
        JSON.stringify({
          error: "Authentication Required",
          message: "Please provide the access password in the X-Access-Password header."
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. VERIFY THE PASSWORD
    if (providedPassword === config.password) {
      if (config.logging) {
        console.log("Password verified successfully");
      }
      
      // PASSWORD VALID! -> Return the content
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Protected Content</title>
</head>
<body>
  <h1>🔓 Access Granted</h1>
  <h2>Welcome to the Protected Area</h2>
  <p>You have successfully authenticated with the correct password.</p>
  <p>This is protected content that was behind a password wall.</p>
  <h3>Features</h3>
  <ul>
    <li>Password-based authentication</li>
    <li>Simple and secure</li>
    <li>Easy to integrate</li>
  </ul>
  <a href="https://example.com">Learn More</a>
</body>
</html>
      `;
      
      return new Response(htmlContent, {
        status: 200,
        headers: { 
          "Content-Type": "text/html",
          "X-Auth-Mode": "password"
        }
      });
    } else {
      if (config.logging) {
        console.log("Password verification failed");
      }
      
      return new Response(
        JSON.stringify({
          error: "Invalid Password",
          message: "The provided password is incorrect."
        }),
        { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  },
};



