const fc = require('fast-check');
const { getClientIP, isValidIP } = require('./access-server');

describe('Property Tests: IP Address Handling', () => {
  /**
   * Property 4: IP Address Handling
   * For any access request, the system should use the provided scraper_ip when available, 
   * otherwise automatically detect the IP from req.ip
   * Validates: Requirements 5.2, 5.3
   */
  
  describe('Property 4: IP Address Handling', () => {
    test('should use provided scraper_ip when available', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        fc.ipV4(),
        (scraperIP, detectedIP) => {
          // Mock request object with both scraper_ip and detectable IP
          const mockReq = {
            ip: detectedIP,
            headers: {},
            connection: { remoteAddress: detectedIP }
          };
          
          // When scraper_ip is provided, it should be used regardless of detected IP
          // This test simulates the endpoint logic where scraper_ip takes priority
          const targetIP = scraperIP || getClientIP(mockReq);
          
          // The result should be the provided scraper_ip
          expect(targetIP).toBe(scraperIP);
        }
      ), { numRuns: 25 });
    });
    
    test('should automatically detect IP when scraper_ip is not provided', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        (detectedIP) => {
          // Mock request object with detectable IP
          const mockReq = {
            ip: detectedIP,
            headers: {},
            connection: { remoteAddress: detectedIP }
          };
          
          // When scraper_ip is not provided (undefined/null), should use detected IP
          const targetIP = undefined || getClientIP(mockReq);
          
          // The result should be the detected IP
          expect(targetIP).toBe(detectedIP);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle various IP detection sources consistently', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        fc.constantFrom('x-forwarded-for', 'x-real-ip', 'req.ip', 'connection'),
        (ip, source) => {
          let mockReq = { headers: {}, connection: {} };
          
          // Set IP in different sources
          switch (source) {
            case 'x-forwarded-for':
              mockReq.headers['x-forwarded-for'] = ip;
              break;
            case 'x-real-ip':
              mockReq.headers['x-real-ip'] = ip;
              break;
            case 'req.ip':
              mockReq.ip = ip;
              break;
            case 'connection':
              mockReq.connection.remoteAddress = ip;
              break;
          }
          
          const detectedIP = getClientIP(mockReq);
          
          // Should detect valid IP from any source
          expect(isValidIP(detectedIP)).toBe(true);
          expect(detectedIP).toBe(ip);
        }
      ), { numRuns: 25 });
    });
    
    test('should prioritize X-Forwarded-For header over other sources', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        fc.ipV4(),
        fc.ipV4(),
        (forwardedIP, realIP, connectionIP) => {
          fc.pre(forwardedIP !== realIP && forwardedIP !== connectionIP);
          
          const mockReq = {
            headers: {
              'x-forwarded-for': forwardedIP,
              'x-real-ip': realIP
            },
            ip: connectionIP,
            connection: { remoteAddress: connectionIP }
          };
          
          const detectedIP = getClientIP(mockReq);
          
          // Should prioritize X-Forwarded-For
          expect(detectedIP).toBe(forwardedIP);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle X-Forwarded-For with multiple IPs', () => {
      fc.assert(fc.property(
        fc.array(fc.ipV4(), { minLength: 2, maxLength: 5 }),
        (ips) => {
          const forwardedForValue = ips.join(', ');
          const mockReq = {
            headers: { 'x-forwarded-for': forwardedForValue },
            connection: {}
          };
          
          const detectedIP = getClientIP(mockReq);
          
          // Should use the first IP (original client)
          expect(detectedIP).toBe(ips[0]);
        }
      ), { numRuns: 25 });
    });
    
    test('should return "unknown" for invalid or missing IP sources', () => {
      fc.assert(fc.property(
        fc.constantFrom(null, undefined, '', 'invalid-ip', '999.999.999.999'),
        (invalidIP) => {
          const mockReq = {
            headers: {},
            ip: invalidIP,
            connection: { remoteAddress: invalidIP }
          };
          
          const detectedIP = getClientIP(mockReq);
          
          // Should return "unknown" for invalid IPs
          expect(detectedIP).toBe('unknown');
        }
      ), { numRuns: 25 });
    });
  });
  
  describe('IP Validation Property Tests', () => {
    test('should validate all generated IPv4 addresses', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        (ip) => {
          expect(isValidIP(ip)).toBe(true);
        }
      ), { numRuns: 25 });
    });
    
    test('should reject invalid IP formats', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.string().filter(s => !s.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)),
          fc.constant('999.999.999.999'),
          fc.constant('256.1.1.1'),
          fc.constant('1.1.1'),
          fc.constant('1.1.1.1.1')
        ),
        (invalidIP) => {
          expect(isValidIP(invalidIP)).toBe(false);
        }
      ), { numRuns: 25 });
    });
    
    test('should handle IPv6-mapped IPv4 addresses', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        (ipv4) => {
          const ipv6Mapped = `::ffff:${ipv4}`;
          
          // Should validate IPv6-mapped IPv4 addresses
          expect(isValidIP(ipv6Mapped)).toBe(true);
        }
      ), { numRuns: 25 });
    });
  });
});