# Bot-Paywall Architecture Diagram

## Data Flow: Connect Cloudflare → Save Project → Scrape

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONNECT CLOUDFLARE FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

USER BROWSER (Frontend)
│
├─→ 1. Fill Form
│   ├─ Website URL: https://example.com
│   ├─ Domain Name: example.com (auto-filled)
│   ├─ API Token: [Cloudflare token]
│   └─ Zone ID: [Auto-fetch OR Manual]
│
├─→ 2a. Auto-Fetch Option
│   │   ├─ Send API Token
│   │   ├─ POST /actions/cloudflare-project
│   │   │   └─ getZonesWithProvidedToken()
│   │   │
│   │   └─→ Cloudflare API: GET /zones
│   │       └─→ Returns [zone1, zone2, zone3...]
│   │
│   └─→ Display Zone Dropdown
│       └─ User selects zone → Zone ID auto-populates
│
├─→ 2b. Manual Option
│   └─ User pastes 32-char Zone ID
│       └─ Validates format [a-f0-9]{32}
│
└─→ 3. Save Project
    ├─ POST /actions/cloudflare-project
    │   └─ saveProjectWithToken()
    │
    ├─→ Validate all inputs
    │   ├─ Domain format
    │   ├─ URL format
    │   ├─ Zone ID format
    │   └─ API token length
    │
    └─→ Database Write
        └─ INSERT/UPDATE projects TABLE
            ├─ name: "example.com"
            ├─ domainName: "example.com"
            ├─ websiteUrl: "https://example.com"
            ├─ zoneId: "abc123def456..."
            ├─ api_keys: "[ENCRYPTED TOKEN]"  ← PER-PROJECT TOKEN!
            └─ status: "ACTIVE"


┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCRAPER FLOW: LIST & SCRAPE PROJECTS                     │
└─────────────────────────────────────────────────────────────────────────────┘

COMMAND LINE (Bot Scraper)
│
├─→ python scraper.py --list-projects
│   │
│   ├─→ GET /api/projects/public (NO AUTH)
│   │   └─→ Main App Database
│   │       └─→ SELECT * FROM projects WHERE status='ACTIVE'
│   │
│   └─→ Display Table
│       ├─ Project ID
│       ├─ Domain Name
│       └─ Website URL
│
└─→ python scraper.py --project [identifier]
    │
    ├─→ 1. Lookup Project (4 methods)
    │   ├─ Method A: --project 1 (index)
    │   ├─ Method B: --project example.com (domain)
    │   ├─ Method C: --project <project-id> (exact ID)
    │   └─ Method D: --url https://example.com (direct)
    │
    ├─→ 2. GET /api/projects/public (if using --project)
    │   └─→ Match logic in get_project_url()
    │       └─→ Extract websiteUrl
    │
    ├─→ 3. Attempt Initial Scrape
    │   └─→ GET https://example.com
    │       └─→ ❌ 402 Payment Required (Cloudflare Worker)
    │
    ├─→ 4. Buy Access (x402 Flow)
    │   ├─ POST /buy-access → Access Server
    │   │   └─ Gets payment instructions
    │   │
    │   ├─ Extract payment info
    │   │   ├─ Amount (in octas)
    │   │   ├─ Payment address
    │   │   └─ Network
    │   │
    │   ├─ Make blockchain payment
    │   │   └─ Transfer MOVE tokens
    │   │
    │   ├─ POST /buy-access (with payment proof)
    │   │   └─→ Access Server
    │   │       └─ Verifies payment
    │   │       └─ Whitelists bot IP
    │   │       └─ Creates Cloudflare WAF rule
    │   │
    │   └─ ✅ Access Granted
    │
    ├─→ 5. Wait for Propagation
    │   └─ Sleep 10 seconds
    │       └─ Allow Cloudflare cache to update
    │
    ├─→ 6. Retry Scrape
    │   └─→ GET https://example.com
    │       ├─ ✅ 200 OK
    │       └─ Save to scraped_content.html
    │
    └─→ Done! Content scraped successfully


┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE SCHEMA CHANGES                             │
└─────────────────────────────────────────────────────────────────────────────┘

PROJECTS TABLE (Updated with per-project token support)

┌──────────────────────────────────────────────────────────────────────────┐
│ projects                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ id            : String (CUID) - Primary key                               │
│ userId        : String - FK → users.userId                               │
│ name          : String - Domain name (e.g., "example.com")               │
│ websiteUrl    : String - Full URL (e.g., "https://example.com")         │
│ domainName    : String? - User-friendly name                             │
│ zoneId        : String - Cloudflare Zone ID (32 hex chars) ⭐ REQUIRED   │
│ nameservers   : String[] - Cloudflare nameservers                       │
│ status        : ProjectStatus - PENDING_NS | ACTIVE | PROTECTED | ERROR  │
│ secretKey     : String - Unique project secret                           │
│ requestsCount : Int - Number of scrape requests                          │
│ createdAt     : DateTime - Created timestamp                             │
│ updatedAt     : DateTime - Last updated timestamp                        │
│ api_keys      : String? - Cloudflare API token (ENCRYPTED) ⭐ NEW!      │
│                                                                            │
│ Relationships:                                                             │
│ ├─ users (one-to-many) via userId                                        │
│                                                                            │
│ Indexes:                                                                   │
│ └─ UNIQUE(userId, name) - One domain per user                            │
└──────────────────────────────────────────────────────────────────────────┘

Changes from Previous Version:
─ Added: api_keys field for per-project Cloudflare API tokens
─ Enhanced: zoneId now REQUIRED (not optional)
─ Improved: domainName for user-friendly display


┌─────────────────────────────────────────────────────────────────────────────┐
│                       API ENDPOINT INTERACTIONS                             │
└─────────────────────────────────────────────────────────────────────────────┘

Bot-Paywall Main App (Next.js)
├─ Frontend: http://localhost:3000
│  └─ /connect-cloudflare → Create/Update Projects
│
├─ Server Actions: /app/actions/
│  ├─ cloudflare-project.ts (NEW)
│  │  ├─ getZonesWithProvidedToken(token) → [zones]
│  │  └─ saveProjectWithToken(...) → { success, projectId }
│  │
│  └─ cloudflare-tokens.ts (Legacy - still works)
│
└─ Public API: /api/
   └─ projects/public → GET /projects → [projects] (no auth)


Cloudflare API
├─ Base: https://api.cloudflare.com/client/v4
└─ Uses per-project token from projects.api_keys
   ├─ GET /zones → List user's zones
   ├─ GET /zones/{zoneId} → Get zone details
   └─ POST /zones/{zoneId}/firewall/rules → Create WAF rules


Access Server (Node.js)
├─ Port: 5000
├─ /payment-info → Get payment address & amount
├─ /buy-access → x402 payment & IP whitelisting
├─ /check-access/{ip} → Check if IP is whitelisted
└─ Communicates with:
   ├─ Cloudflare Worker (validates requests)
   ├─ Movement Blockchain (processes payments)
   └─ Database (stores whitelist)


Scraper (Python)
├─ Fetches projects from: GET /api/projects/public
├─ Scrapes target URL from selected project
├─ Buys access via: POST /buy-access → Access Server
└─ Retries scraping after payment is processed


┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY & ENCRYPTION                              │
└─────────────────────────────────────────────────────────────────────────────┘

API Token Storage (in projects.api_keys)
│
├─→ Frontend Input
│   └─ User pastes token
│
├─→ Server Action Validation
│   ├─ Strip whitespace
│   ├─ Validate format: [a-zA-Z0-9_-]{20,}
│   └─ Check with Cloudflare API
│
├─→ Database Encryption
│   ├─ Token encrypted with AES-256-CBC (existing infrastructure)
│   └─ Stored in encrypted form in projects.api_keys
│
└─→ At Rest
    ├─ Token is encrypted in database
    ├─ Never logged to console
    ├─ Only decrypted when needed for API calls
    └─ Each project has isolated token


Zone ID (Public)
│
└─→ Not encrypted (public information)
    ├─ Visible in Cloudflare Dashboard
    ├─ Not sensitive (can't be exploited alone)
    └─ Always paired with API token for operations
```

## Component Interaction Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                       USER INTERFACE LAYER                         │
├────────────────────────────────────────────────────────────────────┤
│  /connect-cloudflare/page.tsx                                      │
│  ├─ Input: Website URL, Domain Name, API Token, Zone ID           │
│  ├─ Fetch Zones Button → calls getZonesWithProvidedToken()        │
│  ├─ Zone Dropdown → populated from fetch response                 │
│  ├─ Manual Zone ID Input → alternative zone selection             │
│  └─ Create Project Button → calls saveProjectWithToken()          │
└────────────────────────────────────────────────────────────────────┘
                              ↓ (API calls)
┌────────────────────────────────────────────────────────────────────┐
│                    SERVER ACTIONS / MIDDLEWARE                     │
├────────────────────────────────────────────────────────────────────┤
│  /app/actions/cloudflare-project.ts                               │
│  ├─ getZonesWithProvidedToken()                                   │
│  │  └─ Validates token → Calls Cloudflare API → Returns zones    │
│  └─ saveProjectWithToken()                                        │
│     ├─ Validates all inputs                                       │
│     ├─ Checks user authentication                                 │
│     ├─ Upserts user in database                                   │
│     └─ Creates/Updates project with token                         │
└────────────────────────────────────────────────────────────────────┘
                              ↓ (Database calls)
┌────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                             │
├────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (via Prisma ORM)                                       │
│  ├─ users table                                                   │
│  │  └─ userId, email, createdAt, updatedAt                       │
│  └─ projects table                                                │
│     ├─ id, name, domainName, websiteUrl                          │
│     ├─ zoneId (Cloudflare Zone ID)                               │
│     ├─ api_keys (encrypted per-project token) ⭐ NEW             │
│     ├─ status, secretKey, requestsCount                          │
│     └─ createdAt, updatedAt, userId (FK)                         │
└────────────────────────────────────────────────────────────────────┘
                              ↓ (External APIs)
┌────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                             │
├────────────────────────────────────────────────────────────────────┤
│  Cloudflare API (https://api.cloudflare.com/client/v4)            │
│  ├─ GET /zones → Fetch user's zones                              │
│  ├─ Auth: Bearer {api_keys from project}                         │
│  └─ Returns: zones with id, name, status, nameservers           │
│                                                                    │
│  Scraper Access Flow (/api/projects/public)                      │
│  ├─ Bot Scraper queries: GET /api/projects/public               │
│  ├─ Returns: { projects: [ {id, name, websiteUrl} ] }           │
│  └─ Scraper uses websiteUrl to determine target                 │
└────────────────────────────────────────────────────────────────────┘
```

## Request/Response Flow Example

```
=== CONNECT CLOUDFLARE FLOW ===

1️⃣  USER SUBMITS FORM
   POST (Client Action)
   {
     websiteUrl: "https://example.com",
     domainName: "example.com",
     projectApiToken: "v1.abc123xyz789...",
     zoneId: "abc123def456ghi789jkl0123456789",
     manualZoneId: false
   }

2️⃣  VALIDATE & SAVE
   Server Action: saveProjectWithToken()
   - Validate domain format ✓
   - Validate zone ID format ✓
   - Validate URL format ✓
   - Validate token (not empty) ✓
   - Check authentication ✓

3️⃣  DATABASE TRANSACTION
   BEGIN TRANSACTION
   ├─ UPSERT users (ensure user exists)
   ├─ CHECK projects (find existing project)
   ├─ INSERT/UPDATE projects
   │   {
   │     userId: "auth_123...",
   │     name: "example.com",
   │     domainName: "example.com",
   │     websiteUrl: "https://example.com",
   │     zoneId: "abc123def456...",
   │     api_keys: "[ENCRYPTED: v1.abc123xyz789...]",
   │     status: "ACTIVE",
   │     secretKey: "random_32_bytes...",
   │     requestsCount: 0
   │   }
   COMMIT

4️⃣  RESPONSE
   {
     success: true,
     projectId: "clm123abc456...",
     message: "Project 'example.com' saved successfully"
   }

5️⃣  FRONTEND UPDATE
   ✓ Display success message
   ✓ Show Zone ID
   ✓ Show Nameservers
   ✓ Offer navigation to Dashboard


=== SCRAPER FLOW ===

1️⃣  USER LISTS PROJECTS
   python scraper.py --list-projects

2️⃣  FETCH PROJECTS
   GET http://localhost:3000/api/projects/public
   
   Response:
   {
     success: true,
     projects: [
       {
         id: "clm123abc456def789...",
         name: "example.com",
         domainName: "example.com",
         websiteUrl: "https://example.com",
         status: "ACTIVE"
       },
       ...
     ],
     count: 2
   }

3️⃣  DISPLAY PROJECTS
   Print table:
   ┌─────────────────────────────────────────────────────┐
   │ # │ Project ID              │ Domain    │ URL       │
   ├─────────────────────────────────────────────────────┤
   │ 1 │ clm123abc456def789...   │ example.c │ https://e │
   │ 2 │ xyz789abc123def456...   │ test.com  │ https://t │
   └─────────────────────────────────────────────────────┘

4️⃣  USER SCRAPES PROJECT
   python scraper.py --project 1

5️⃣  SCRAPER RESOLVES PROJECT
   get_project_url("1"):
   ├─ Check if digit: YES
   ├─ Get index: 0 (1-based index)
   ├─ Return: projects[0].websiteUrl
   └─ → "https://example.com"

6️⃣  SCRAPER CONTINUES
   - Attempt GET https://example.com
   - Receive 402 Payment Required
   - Extract client IP
   - Buy access (make blockchain payment)
   - Whitelist IP
   - Wait for propagation
   - Retry GET https://example.com
   - Receive 200 OK ✓
   - Save to scraped_content.html
```

