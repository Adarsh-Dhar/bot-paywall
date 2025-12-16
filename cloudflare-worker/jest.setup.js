// Jest setup file for Cloudflare Worker tests

// Mock global fetch for Cloudflare Worker environment
global.fetch = jest.fn();

// Mock Request and Response constructors for Cloudflare Worker environment
global.Request = class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = {
      get: (key) => {
        if (options.headers && options.headers[key]) {
          return options.headers[key];
        }
        return null;
      }
    };
  }
};

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = {
      get: (key) => {
        if (options.headers && options.headers[key]) {
          return options.headers[key];
        }
        return null;
      }
    };
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
};