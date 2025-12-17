# Gatekeeper Bot Firewall - Setup Guide

## Why Buttons Aren't Working

The buttons on your frontend are properly wired, but they're failing silently because of missing configuration. Here's what needs to be fixed:

## Step 1: Set Up Cloudflare API Credentials

### Get Your Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit zone DNS" template (or create custom with these permissions):
   - Zone > Zone > Read
   - Zone > DNS > Edit
   - Zone > Firewall Services > Edit
4. Copy the token and add to `.env`:

```
CLOUDFLARE_API_TOKEN=your_token_here
```

### Get Your Cloudflare Account ID

1. Go to https://dash.cloudflare.com/
2. Click on any domain
3. In the right sidebar under "API", copy the "Account ID"
4. Add to `.env`:

```
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

## Step 2: Set Up Supabase

### Get Supabase Credentials

1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### Create Database Schema

Run this SQL in your Supabase SQL editor:

```sql
-- Create projects table
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own projects" ON projects
  FOR ALL USING (auth.uid()::text = user_id);
```

## Step 3: Update Your .env File

Your `.env` should now look like:

```properties
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
```

## Step 4: Test the Flow

1. **Start the dev server:**
   ```bash
   pnpm dev
   ```

2. **Sign in** with Clerk

3. **Click "Add New Domain"** button

4. **Enter a test domain** (e.g., `test-example.com`)

5. **Click "Add Domain"** - This should:
   - Create a Cloudflare zone
   - Generate a secret key
   - Save to Supabase
   - Show you the nameservers

6. **Update nameservers** at your registrar (or skip for testing)

7. **Click "I have updated them, Verify Now"** - This should:
   - Check Cloudflare zone status
   - Deploy WAF rule if active
   - Update project status to "protected"

## Troubleshooting

### "Failed to create Cloudflare zone"
- Check `CLOUDFLARE_API_TOKEN` is correct
- Check `CLOUDFLARE_ACCOUNT_ID` is correct
- Verify token has DNS edit permissions

### "Failed to save project to database"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify `projects` table exists in Supabase
- Check RLS policies are correct

### "User not authenticated"
- Make sure you're signed in with Clerk
- Check `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are correct

### Buttons still not working
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try clicking a button
4. Look for error messages
5. Share the error with the team

## How It Works

### Phase 1: Domain Registration
1. User enters domain name
2. App calls `registerDomain()` server action
3. Server creates Cloudflare zone via API
4. Server generates secret key
5. Server saves project to Supabase
6. UI shows nameservers to user

### Phase 2: Nameserver Update
1. User updates nameservers at registrar
2. User clicks "Verify Now"
3. App calls `verifyAndConfigure()` server action
4. Server checks Cloudflare zone status
5. If active, server deploys WAF rule
6. Server updates project status to "protected"
7. UI shows "Protected" badge

### Phase 3: Protection Active
1. All requests to domain go through Cloudflare
2. WAF rule blocks bots without the secret key
3. Legitimate users and VIPs pass through
4. Users with `x-bot-password` header can access

## WAF Rule Logic

The deployed rule blocks requests that match ALL of:
- Looks like a bot (curl, python, bot in user-agent, or Cloudflare bot detection)
- AND doesn't have the correct secret key in `x-bot-password` header
- AND is not a verified bot (Google, Bing, etc.)

Action: `managed_challenge` (shows CAPTCHA)

## Next Steps

1. Set up all environment variables
2. Create Supabase table
3. Test the flow
4. Deploy to production
5. Monitor WAF rules in Cloudflare dashboard
