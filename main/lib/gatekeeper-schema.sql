-- Gatekeeper Projects Table
-- This table stores all user projects for domain protection

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  zone_id TEXT,
  nameservers JSONB,
  status TEXT NOT NULL DEFAULT 'pending_ns' CHECK (status IN ('pending_ns', 'active', 'protected')),
  secret_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create index on zone_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_zone_id ON projects(zone_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to ensure users can only see their own projects
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE
  USING (auth.uid()::text = user_id);
