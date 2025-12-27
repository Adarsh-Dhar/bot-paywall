# Bot-Paywall Quick Reference Guide

## Updated Connect-Cloudflare Form

### New Form Fields (All Required)
```
1. Website URL          → https://example.com
2. Domain Name          → example.com (auto-fills)
3. API Token            → Your Cloudflare API token
4. Zone ID              → Either auto-fetch OR manual entry
```

### Zone ID Selection (Choose One Method)

#### Method A: Auto-Fetch from Token
```
1. Enter Cloudflare API token
2. Click "Fetch Available Zones"
3. Select zone from dropdown
4. Zone details auto-populate
```

#### Method B: Manual Entry
```
1. Click "Enter Manually" toggle
2. Paste your 32-character Zone ID
3. Zone ID validates format
4. Proceed to save
```

### Finding Your Zone ID
- **In Cloudflare Dashboard**: Select domain → Overview → Zone ID (right sidebar)
- **From List**: Run `python scraper.py --list-projects` to see all project zones

---

## Updated Scraper Commands

### List All Bot-Paywall Projects
```bash
python scraper.py --list-projects
```

**Output Format:**
```
================================ AVAILABLE PROJECTS IN BOT-PAYWALL ================================
#   | Project ID (40 chars)        | Domain Name        | Website URL
----|------------------------------|-------------------|-----------------------------
1   | abc123def456ghi789jkl0123... | mysite.com         | https://mysite.com
2   | xyz789abc123def456ghi7890... | example.org        | https://example.org
...
```

### Scrape by Index Number (Easiest)
```bash
python scraper.py --project 1
```
Uses the first project from `--list-projects` output

### Scrape by Domain Name
```bash
python scraper.py --project mysite.com
```
Must match exactly (case-insensitive)

### Scrape by Project ID
```bash
python scraper.py --project abc123def456ghi789jkl0123456789
```
Full 32-40 character project ID

### Scrape by Direct URL (Bypass Lookup)
```bash
python scraper.py --url https://mysite.com
```
Doesn't require project to be in bot-paywall

---

## Database Updates

### Projects Table
Each project now stores:
- `name`: Domain name (e.g., "example.com")
- `domainName`: User-friendly name (same as name)
- `websiteUrl`: Full website URL
- `zoneId`: Cloudflare Zone ID (32 hex chars)
- `api_keys`: Per-project Cloudflare API token ⭐ NEW
- `status`: Project status (PENDING_NS, ACTIVE, PROTECTED, ERROR)

---

## API Endpoints

### Get Available Projects (Public)
```
GET /api/projects/public
Returns: { success: true, projects: [...], count: number }
```

### Create/Update Project (Server Action)
```javascript
// In /main/app/actions/cloudflare-project.ts
await saveProjectWithToken(
  websiteUrl,      // "https://example.com"
  domainName,      // "example.com"
  apiToken,        // Cloudflare API token
  zoneId,          // "32-character-zone-id"
  nameservers?     // Optional array
)
```

---

## Troubleshooting

### "No zones found" Error
- ✅ Verify API token is valid and active
- ✅ Confirm token has `Zone:Read` and `Zone:Edit` permissions
- ✅ Check that domain is added to your Cloudflare account
- ✅ Ensure token isn't restricted to specific zones

### "Invalid Zone ID format" Error
- ✅ Zone ID must be exactly 32 hexadecimal characters
- ✅ Copy from Cloudflare Dashboard, not from browser history
- ✅ Remove any extra spaces or line breaks

### "Project not found" in Scraper
- ✅ Run `--list-projects` to see exact project names/IDs
- ✅ Domain name is case-insensitive (example.com = EXAMPLE.COM)
- ✅ Use exact domain (with or without www)

### "Connection refused" to Main App
- ✅ Ensure bot-paywall main app is running on port 3000
- ✅ Check `CONFIG['main_app_url']` in scraper.py
- ✅ Verify no firewall blocking the connection

---

## Security Notes

### API Token Handling
- Tokens are stored in database (encrypted at rest)
- Each project can have different permissions
- Tokens are never logged or exposed in logs
- Consider rotating tokens periodically

### Zone ID Safety
- Zone ID is not secret (it's public in Cloudflare UI)
- Zone ID alone cannot access your domain
- Always pair with valid API token for operations

---

## Environment Variables

### Main App (.env or .env.local)
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
# Cloudflare configuration (optional - no longer required for global token)
```

### Scraper (scraper.py CONFIG)
```python
CONFIG = {
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    'access_server_url': 'http://localhost:5000',     # x402 payment handler
    'main_app_url': 'http://localhost:3000',          # bot-paywall main app
    'max_retries': 3,
    'wait_after_payment': 10,
    'retry_delay': 5
}
```

---

## Complete Workflow Example

### Step 1: Create API Token in Cloudflare
```
1. Dashboard → Your Profile → API Tokens
2. Create Token → Edit zone DNS
3. Copy the token (40+ characters)
```

### Step 2: Add Project in Bot-Paywall
```
1. Visit http://localhost:3000/connect-cloudflare
2. Enter: https://mysite.com
3. Domain auto-fills: mysite.com
4. Paste Cloudflare API token
5. Click "Fetch Available Zones"
6. Select zone from dropdown
7. Click "Create Project"
```

### Step 3: List Projects with Scraper
```bash
python scraper.py --list-projects
```

Output shows your new project (let's say index 1)

### Step 4: Scrape Protected Site
```bash
python scraper.py --project 1
```

The scraper will:
1. Get your project URL from bot-paywall
2. Attempt to scrape (gets 402 Payment Required)
3. Make x402 payment
4. Get whitelisted via access-server
5. Scrape successfully ✅

---

## FAQs

**Q: Do I need a global Cloudflare token anymore?**
A: No! Each project stores its own token. Legacy global token support still works.

**Q: Can I use the same API token for multiple projects?**
A: Yes, but it's not recommended. Create separate tokens for better security.

**Q: What permissions does the API token need?**
A: Minimum: `Zone:Read` and `Zone:Edit` on all zones (or specific zones).

**Q: Can I change the API token after creating a project?**
A: Yes! Just go back to `/connect-cloudflare` and re-enter the project with a new token.

**Q: How do I get my Zone ID without the web UI?**
A: Run scraper with `--list-projects` to see all zones, or check Cloudflare Dashboard → Overview.

**Q: Is the Zone ID required or can I just use the domain?**
A: Zone ID is required for the database. Domain alone isn't unique enough.

