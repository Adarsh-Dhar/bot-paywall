CREATE TABLE IF NOT EXISTS receipts (
    tx_hash TEXT PRIMARY KEY,
    amount TEXT,
    sender TEXT,
    timestamp INTEGER
);