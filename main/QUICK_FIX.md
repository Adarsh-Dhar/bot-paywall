# Quick Fix - 5 Minutes

## TL;DR

Your buttons aren't working because **3 environment variables are missing**. Add them and restart.

## The 3 Missing Variables

```bash
# 1. Get from https://dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_API_TOKEN=your_token_here

# 2. Get from https://dash.cloudflare.com/ (any domain, right sidebar)
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# 3. Get from https://app.supabase.com (Settings > API > service_role secret)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Steps

1. **Get Cloudflare API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit zone DNS" template
   - Copy token

2. **Get Cloudflare Account ID:**
   - Go to https://dash.cloudflare.com/
   - Click any domain
   - Copy "Account ID" from right sidebar

3. **Get Supabase Service Role Key:**
   - Go to https://app.supabase.com
   - Select your project
   - Go to Settings > API
   - Copy "service_role secret" key

4. **Add to main/.env:**
   ```
   CLOUDFLARE_API_TOKEN=paste_here
   CLOUDFLARE_ACCOUNT_ID=paste_here
   SUPABASE_SERVICE_ROLE_KEY=paste_here
   ```

5. **Restart dev server:**
   ```bash
   # Stop: Ctrl+C
   # Start: pnpm dev
   ```

6. **Create Supabase table:**
   - Go to https://app.supabase.com
   - Go to SQL Editor
   - Paste this:
   ```sql
   CREATE TABLE IF NOT EXISTS projects (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id TEXT NOT NULL,
     name TEXT NOT NULL,
     zone_id TEXT,
     nameservers TEXT[] DEFAULT ARRAY[]::TEXT[],
     status TEXT DEFAULT 'pending_ns',
     secret_key TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT now(),
     updated_at TIMESTAMP DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can only access their own projects" ON projects
     FOR ALL USING (auth.uid()::text = user_id);
   ```
   - Click "Run"

7. **Test:**
   - Sign in
   - Click "Add New Domain"
   - Enter domain
   - Click "Add Domain"
   - Should work! ✅

## If Still Not Working

1. Open DevTools (F12)
2. Go to Console tab
3. Click button
4. Look for error
5. Share error with team

## Files to Reference

- `main/BUTTONS_NOT_WORKING_FIX.md` - Detailed explanation
- `main/GATEKEEPER_SETUP.md` - Full setup guide
- `main/lib/debug-gatekeeper.ts` - Debug utility
