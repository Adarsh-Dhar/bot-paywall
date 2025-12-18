-- Initialize the database with required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the database user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gatekeeper_user') THEN
        CREATE ROLE gatekeeper_user WITH LOGIN PASSWORD 'gatekeeper_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE gatekeeper TO gatekeeper_user;
GRANT ALL ON SCHEMA public TO gatekeeper_user;