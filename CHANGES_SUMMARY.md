# Bot-Paywall Configuration Changes Summary

## Overview
Updated the bot-paywall project to improve the Cloudflare integration flow and scraper functionality. The changes enable users to provide per-project Cloudflare API tokens and Zone IDs, and allow the scraper to fetch and target specific projects from the main app.

## Changes Made

### 1. Frontend: Connect Cloudflare Page (`/main/app/connect-cloudflare/page.tsx`)

#### What Changed
- **Simplified Flow**: Removed the global token step; users now provide API token per project
- **New Input Fields**:
  - Website URL (required)
  - Domain Name (required)
  - Cloudflare API Token (required) - per project
  - Zone ID (required) - can be auto-fetched or entered manually

#### Key Features
- **Two Zone ID Options**:
  1. **Auto-Fetch**: Enter API token and click "Fetch Available Zones" to auto-populate dropdown
  2. **Manual Entry**: Directly enter the 32-character Zone ID if you already have it

- **Auto-fill Domain**: Website URL automatically extracts domain name
- **Zone Info Display**: Shows selected zone details for verification

#### Benefits
- Each project can have its own API token (better security/isolation)
- Flexible zone ID input (supports both auto-fetch and manual)
- Clear visual separation between input methods

### 2. Backend: New Server Action (`/main/app/actions/cloudflare-project.ts`)

#### New Functions
- **`getZonesWithProvidedToken(apiToken: string)`**
  - Fetches Cloudflare zones using a provided API token
  - Validates token format and connectivity
  - Returns array of available zones with details

- **`saveProjectWithToken(...)`**
  - Saves project with its own API token and Zone ID
  - Validates all inputs (domain format, Zone ID format, URL)
  - Creates or updates project in database
  - Stores API token in project's `api_keys` field

#### Security
- Token validation (length, character set)
- Input sanitization and validation
- Database transaction for consistency

### 3. Web Scraper: Enhanced Project Management (`/webscrapper/scraper.py`)

#### What Changed
- **Clear Bot-Paywall Identification**: Updated all docstrings and help text to clearly identify this as the bot-paywall scraper
- **Improved Project Listing**: Enhanced `list_available_projects()` function with:
  - Better formatted table showing Project ID, Domain Name, and Website URL
  - Clear project identification
  - Usage examples for each project selection method

- **Enhanced Project Lookup**: Improved `get_project_url()` function with multiple matching methods:
  1. **Index Number**: `--project 1` (from list output)
  2. **Project ID**: `--project <exact-project-id>`
  3. **Domain Name**: `--project example.com`
  4. **Partial Match**: `--project partial-name`
  5. **Direct URL**: `--url https://example.com` (bypasses lookup)

#### Logging Improvements
- Added detailed logging showing which matching method succeeded
- Better error messages indicating what went wrong
- Helpful hints for troubleshooting

#### Command Line Help
Updated help text and examples to clearly show bot-paywall integration:

```bash
# List all projects from bot-paywall
python scraper.py --list-projects

# Scrape by project index
python scraper.py --project 1

# Scrape by domain
python scraper.py --project example.com

# Scrape by project ID
python scraper.py --project 1a2b3c4d...

# Use direct URL
python scraper.py --url https://example.com
```

### 4. Database Schema (No Changes Required)

The existing `schema.prisma` already supports all needed fields:
- `projects.api_keys` - stores per-project API token
- `projects.zoneId` - stores Cloudflare Zone ID
- `projects.domainName` - stores user-friendly domain name
- `projects.websiteUrl` - stores full website URL

## Workflow Examples

### Example 1: Connect Cloudflare via Web UI

1. Go to `/connect-cloudflare`
2. Enter website URL: `https://mysite.com`
3. Domain auto-fills: `mysite.com`
4. Enter your Cloudflare API token
5. Click "Fetch Available Zones"
6. Select your zone from dropdown
7. Click "Create Project"
8. Done! Project is saved with its own API token

### Example 2: Scrape a Protected Project

```bash
# Step 1: List available projects
python scraper.py --list-projects

# Output shows projects like:
# 1  | abc123def456...  | mysite.com  | https://mysite.com

# Step 2: Scrape the project
python scraper.py --project 1

# Or by domain:
python scraper.py --project mysite.com

# Or by project ID:
python scraper.py --project abc123def456...
```

### Example 3: Manual Zone ID Entry

If you already know your Zone ID:
1. Go to `/connect-cloudflare`
2. Fill in Website URL and Domain Name
3. Enter API token
4. Click "Enter Manually" (Zone ID section)
5. Paste your 32-character Zone ID
6. Click "Create Project"

## Technical Details

### API Token Storage
- Tokens are stored in `projects.api_keys` field
- Each project has its own token
- Frontend doesn't need a global Cloudflare token anymore
- API tokens are encrypted at rest (handled by existing infrastructure)

### Zone ID Format
- Must be exactly 32 hexadecimal characters
- Format: `[a-f0-9]{32}` (case-insensitive)
- Example: `abc123def456ghi789jkl012mno345pq`

### Cloudflare API Integration
- Uses Cloudflare API v4 (`https://api.cloudflare.com/client/v4`)
- Fetches zones from: `GET /zones?per_page=50`
- Each token must have:
  - `Zone:Read` permission
  - `Zone:Edit` permission
  - Access to all zones (or at least the target zone)

## Testing

### Frontend Testing
```bash
cd main
npm run dev
# Visit http://localhost:3000/connect-cloudflare
```

### Scraper Testing
```bash
cd webscrapper

# List projects
python scraper.py --list-projects

# Scrape a project
python scraper.py --project 1
```

### Backend Testing
```bash
# No new API endpoints - uses existing /api/projects/public
# Server actions tested via Next.js
```

## Backward Compatibility

- Existing projects continue to work
- Users with global token can still use old flow
- New projects can use per-project tokens
- Scraper automatically handles both old and new project formats

## Migration Guide (Optional)

If you want to migrate existing projects to per-project tokens:
1. For each project, create a new Cloudflare API token
2. Update the project via `/connect-cloudflare`
3. Enter the new per-project token
4. The system will update the project record

## Files Modified

1. ✅ `/main/app/connect-cloudflare/page.tsx` - New UI flow
2. ✅ `/main/app/actions/cloudflare-project.ts` - New server actions
3. ✅ `/webscrapper/scraper.py` - Enhanced project lookup and listing
4. ✅ `/main/app/api/projects/public/route.ts` - Already had public endpoint

## Files Not Modified (Already Correct)

- `/main/prisma/schema.prisma` - Schema already supports per-project tokens
- `/main/app/actions/cloudflare-tokens.ts` - Legacy flow still works
- `/main/app/actions/cloudflare-token-verification.ts` - Legacy flow still works
- Other database models - No changes needed

