CREATE TABLE IF NOT EXISTS products (
    path TEXT PRIMARY KEY,
    price TEXT, -- Amount in MOVE (e.g., "0.1")
    recipient TEXT -- Wallet address
);

CREATE TABLE IF NOT EXISTS nonces (
    tx_hash TEXT PRIMARY KEY,
    created_at INTEGER
);

-- Seed some data (The product we are selling)
INSERT INTO products (path, price, recipient) 
VALUES ('/api/secret-data', '0.01', '0xYOUR_WALLET_ADDRESS_HERE');