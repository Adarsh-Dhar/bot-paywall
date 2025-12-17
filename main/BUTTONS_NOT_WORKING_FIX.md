# Why Your Buttons Aren't Working - And How to Fix It

## The Problem

Your frontend buttons are **properly wired** and **correctly implemented**. The issue is that they're calling server actions that are **failing silently** because of missing configuration.

When you click a button:
1. ✅ Button click handler fires
2. ✅ Server action is called
3. ❌ Server action fails (missing env vars)
4. ❌ Error is caught and logged to console
5. ❌ UI doesn't update (no feedback to user)

## Root Causes

### 1. Missing Cloudflare Credentials
The `registerDomain()` action tries to call the Cloudflare API but fails because:
- `CLOUDFLARE_API_TOKEN` is not set
- `CLOUDFLARE_ACCOUNT_ID` is not set

### 2. Missing Supabase Service Role Key
The server actions try to write to Supabase but fail because:
- `SUPABASE_SERVICE_ROLE_KEY` is not set
- Without this, the server can't authenticate as admin to write data

### 3. Missing Database Schema
Even if credentials were set, the `projects` table might not exist in Supabase.

## The Fix (3 Steps)

### Step 1: Get Cloudflare Credentials

**API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Select "Edit zone DNS" template
4. Create and copy the token

**Account ID:**
1. Go to https://dash.cloudflare.com/
2. Click any domain
3. Copy "Account ID" from the right sidebar

### Step 2: Get Supabase Credentials

1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy all three keys:
   - `Project URL`
   - `anon public` key
   - `service_role secret` key

### Step 3: Update .env File

Edit `main/.env` and add:

```properties
# Cloudflare
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Supabase (add the missing one)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 4: Create Database Schema

In Supabase SQL editor, run:

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

## How to Debug

### Check Console Errors

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click a button
4. Look for error messages
5. Common errors:
   - `"CLOUDFLARE_API_TOKEN environment variable is not set"`
   - `"Failed to save project to database"`
   - `"User not authenticated"`

### Check Server Logs

1. Look at your terminal where `pnpm dev` is running
2. Server-side errors will be logged there
3. Look for stack traces

### Test Each Component

**Test Clerk:**
```javascript
// In browser console
fetch('/api/auth/me')
```

**Test Supabase:**
```javascript
// In browser console
const { data } = await supabase.from('projects').select('*').limit(1)
console.log(data)
```

**Test Cloudflare:**
```bash
# In terminal
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.cloudflare.com/client/v4/zones
```

## What Each Button Does

### "Add New Domain" Button
1. Opens modal
2. User enters domain
3. Clicks "Add Domain"
4. Server action `registerDomain()` runs:
   - Creates Cloudflare zone
   - Generates secret key
   - Saves to Supabase
   - Returns nameservers

### "I have updated them, Verify Now" Button
1. Calls server action `verifyAndConfigure()`
2. Checks Cloudflare zone status
3. If active, deploys WAF rule
4. Updates project status to "protected"

## Quick Checklist

- [ ] Cloudflare API token obtained and added to .env
- [ ] Cloudflare Account ID obtained and added to .env
- [ ] Supabase service role key added to .env
- [ ] Supabase projects table created
- [ ] Dev server restarted after .env changes
- [ ] Signed in with Clerk
- [ ] Clicked "Add New Domain" button
- [ ] Entered a test domain
- [ ] Clicked "Add Domain" button
- [ ] Saw nameservers displayed
- [ ] Clicked "Verify Now" button

## Still Not Working?

1. **Restart dev server** - Changes to .env require restart
2. **Clear browser cache** - Ctrl+Shift+Delete
3. **Check browser console** - F12 > Console tab
4. **Check terminal logs** - Look for error messages
5. **Verify credentials** - Make sure tokens are correct
6. **Check database** - Verify projects table exists

## File Structure

```
main/
├── app/
│   ├── actions/
│   │   └── gatekeeper.ts          ← Server actions (registerDomain, verifyAndConfigure)
│   └── dashboard/
│       ├── page.tsx               ← Dashboard with "Add New Domain" button
│       ├── [id]/
│       │   └── page.tsx           ← Project detail with "Verify Now" button
│       └── components/
│           ├── CreateProjectModal.tsx    ← Modal for adding domain
│           ├── PendingNameserversView.tsx ← Shows nameservers & verify button
│           └── ProtectedView.tsx         ← Shows protected status
├── lib/
│   ├── cloudflare-api.ts          ← Cloudflare API calls
│   ├── supabase-client.ts         ← Supabase client setup
│   └── secret-key-generator.ts    ← Generates secret keys
└── types/
    └── gatekeeper.ts              ← TypeScript types
```

## Environment Variables Reference

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `CLOUDFLARE_API_TOKEN` | Authenticate with Cloudflare API | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Identify your Cloudflare account | https://dash.cloudflare.com/ (any domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | https://app.supabase.com (Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key | https://app.supabase.com (Settings > API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase key (server-side only) | https://app.supabase.com (Settings > API) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public Clerk key | https://dashboard.clerk.com (API Keys) |
| `CLERK_SECRET_KEY` | Secret Clerk key (server-side only) | https://dashboard.clerk.com (API Keys) |

## Next Steps

1. Follow the 4-step fix above
2. Restart your dev server
3. Test the buttons
4. Check browser console for errors
5. Share any errors with the team

Good luck! 🚀
