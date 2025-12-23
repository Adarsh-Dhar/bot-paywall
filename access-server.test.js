const request = require('supertest');
const { app, CONFIG } = require('./access-server');

describe('Server Setup Tests', () => {
  describe('Server Configuration', () => {
    test('should have correct port configuration', () => {
      expect(CONFIG.SERVER_PORT).toBe(3000);
    });
    
    test('should have all required configuration constants', () => {
      expect(CONFIG.CLOUDFLARE_TOKEN).toBeDefined();
      expect(CONFIG.CLOUDFLARE_ZONE_ID).toBeDefined();
      expect(CONFIG.CLOUDFLARE_API_URL).toBeDefined();
      expect(CONFIG.PAYMENT_DESTINATION).toBeDefined();
      expect(CONFIG.REQUIRED_AMOUNT_OCTAS).toBe(1000000);
      expect(CONFIG.SUBSCRIPTION_DURATION_MS).toBe(60000);
    });
  });

  describe('JSON Request Parsing', () => {
    test('should parse valid JSON requests', async () => {
      const response = await request(app)
        .post('/buy-access')
        .send({ tx_hash: 'test_hash' })
        .expect('Content-Type', /json/);
      
      // Should not return JSON parsing error (400 with specific message)
      expect(response.status).not.toBe(400);
      expect(response.body.error).not.toMatch(/Invalid JSON/);
    });
    
    test('should reject invalid JSON with proper error', async () => {
      const response = await request(app)
        .post('/buy-access')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
      
      expect(response.body.error).toMatch(/Invalid JSON/);
      expect(response.body.code).toBe(400);
    });
    
    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/buy-access')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Missing required field: tx_hash/);
    });
  });

  describe('Basic Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      await request(app)
        .get('/non-existent')
        .expect(404);
    });
    
    test('should handle missing tx_hash field', async () => {
      const response = await request(app)
        .post('/buy-access')
        .send({ scraper_ip: '192.168.1.1' })
        .expect(400);
      
      expect(response.body.error).toBe('Missing required field: tx_hash');
      expect(response.body.code).toBe(400);
    });
    
    test('should provide health check endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.activeConnections).toBeDefined();
    });
  });

  describe('Middleware Setup', () => {
    test('should accept application/json content type', async () => {
      await request(app)
        .post('/buy-access')
        .set('Content-Type', 'application/json')
        .send({ tx_hash: 'test' })
        .expect((res) => {
          // Should not fail due to content type issues
          expect(res.status).not.toBe(415); // Unsupported Media Type
        });
    });
    
    test('should handle requests without content-type header', async () => {
      await request(app)
        .post('/buy-access')
        .send({ tx_hash: 'test' })
        .expect((res) => {
          // Should still process the request
          expect(res.status).not.toBe(415);
        });
    });
  });
});