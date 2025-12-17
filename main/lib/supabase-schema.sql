-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  requests_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);

-- Enable Row-Level Security on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for projects: users can only access their own projects
CREATE POLICY IF NOT EXISTS projects_user_isolation ON projects
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS projects_user_insert ON projects
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY IF NOT EXISTS projects_user_update ON projects
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Enable Row-Level Security on api_keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for api_keys: users can only access keys for their projects
CREATE POLICY IF NOT EXISTS api_keys_user_isolation ON api_keys
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE auth.uid()::text = user_id
    )
  );

CREATE POLICY IF NOT EXISTS api_keys_user_insert ON api_keys
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE auth.uid()::text = user_id
    )
  );
