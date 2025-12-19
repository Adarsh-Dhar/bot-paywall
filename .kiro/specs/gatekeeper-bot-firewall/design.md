# Design Document: Gatekeeper Bot Firewall

## Overview

Gatekeeper is a SaaS dashboard that automates bot protection for user domains through Cloudflare integration. The system manages three core workflows:

1. **Domain Registration**: Users register a domain, which triggers automatic Cloudflare zone creation and secret key generation
2. **Nameserver Verification**: Users update their registrar's nameservers and verify completion through the dashboard
3. **Protection Bypass Activation**: Once verified, the system deploys a custom WAF skip rule that allows authorized applications to bypass bot protection using the X-Partner-Key header

The architecture separates concerns into database layer (Supabase), API integration layer (Cloudflare), server actions (Next.js), and UI components (React/Shadcn).

## Architecture

### High-Level Flow

```
User Registration → Cloudflare Zone Creation → Nameserver Display → Verification → WAF Skip Rule Deployment → Protected Status
```

### Component Layers

1. **Frontend Layer**: React components using Shadcn/UI for dashboard and setup views
2. **Server Actions Layer**: Next.js server actions for Cloudflare API calls and database operations
3. **Database Layer**: Supabase PostgreSQL for project persistence
4. **External API Layer**: Cloudflare API for zone management and WAF skip rules

### Authentication & Authorization

- Clerk handles user authentication
- Middleware validates user sessions on protected routes
- Database queries filter by authenticated user_id
- Server actions verify user ownership before performing operations

## Components and Interfaces

### Database Schema

**Table: projects**
```
- id (uuid, primary key, default: gen_random_uuid())
- user_id (text, not null) — Clerk User ID
- name (text, not null) — Domain name
- zone_id (text, nullable) — Cloudflare Zone ID
- nameservers (jsonb, nullable) — Array of nameserver strings
- status (text, default: 'pending_ns') — 'pending_ns' | 'active' | 'protected'
- secret_key (text, not null) — Generated backdoor password
- created_at (timestamptz, default: now())
```

### Server Actions Interface

#### Action A: registerDomain(domain: string)

**Input:**
- domain: string (e.g., "startup.com")

**Process:**
1. Validate domain format
2. Generate 32-character secret key using UUID
3. Call Cloudflare API: POST /zones
4. Extract zone_id and nameservers from response
5. Insert project record into database
6. Return nameservers to UI

**Output:**
```typescript
{
  success: boolean;
  zone_id?: string;
  nameservers?: string[];
  secret_key?: string;
  error?: string;
}
```

**Cloudflare API Call:**
```
POST https://api.cloudflare.com/client/v4/zones
Headers: Authorization: Bearer {CLOUDFLARE_API_TOKEN}
Body: {
  "name": domain,
  "account": { "id": CLOUDFLARE_ACCOUNT_ID },
  "type": "full"
}
```

#### Action B: verifyProjectStatus(projectId: string) - New Dedicated Module

**Location:** `actions/cloudflare-verification.ts`

**Input:**
- projectId: string (UUID)

**Process:**
1. Fetch project from database including zone_id, encrypted api_token, and secret_key
2. Verify user ownership
3. Decrypt user's Cloudflare API token
4. Call Cloudflare API: GET /zones/{zone_id}
5. Handle status cases:
   - Case A: Status is 'pending' → Return { status: 'pending_ns', message: 'Waiting for Nameserver update.' }
   - Case B: Status is 'active' → Deploy WAF rules and update to 'protected'
6. For active zones:
   - Get ruleset ID via POST /zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint
   - Deploy WAF rule with smart backdoor payload
   - Update project status to 'protected'
   - Return { status: 'protected', message: 'Domain active & Firewall injected.' }

#### Action C: verifyAndConfigure(projectId: string) - Legacy (Deprecated)

**Input:**
- projectId: string (UUID)

**Process:**
1. Fetch project from database
2. Verify user ownership
3. Call Cloudflare API: GET /zones/{zone_id}
4. Check if zone status is "active"
5. If active, deploy WAF skip rule via POST /zones/{zone_id}/rulesets/phases/http_request_firewall_custom/rules
6. Update project status to 'protected'
7. Return success or pending status

**Output:**
```typescript
{
  status: 'success' | 'pending' | 'error';
  message: string;
  protected?: boolean;
}
```

**Cloudflare API Calls:**

Check Zone Status:
```
GET https://api.cloudflare.com/client/v4/zones/{zone_id}
Headers: Authorization: Bearer {CLOUDFLARE_API_TOKEN}
```

Deploy WAF Skip Rule:
```
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/phases/http_request_firewall_custom/rules
Headers: Authorization: Bearer {CLOUDFLARE_API_TOKEN}
Body: {
  "rules": [{
    "description": "Gatekeeper: Partner Key Bypass",
    "expression": "(http.request.headers[\"X-Partner-Key\"] eq \"CLIENT_SECRET_123\")",
    "action": "skip",
    "action_parameters": {
      "ruleset": "current",
      "phases": ["http_request_sbfm", "http_ratelimit"]
    },
    "enabled": true
  }]
}
```

### Frontend Components

#### Dashboard Page (/dashboard)

**Component: ProjectGrid**
- Displays all user projects in a responsive grid
- Each card shows domain name and status badge
- Status badges: Yellow with "⚠ Pending Setup" (pending_ns), Green with "✅ Secure & Active" (protected)
- "Add New Domain" button opens CreateProjectModal

**Component: CreateProjectModal**
- Modal with domain input field
- Form validation for domain format
- Submit button triggers registerDomain action
- Error handling and loading states
- Success closes modal and refreshes project list

#### Setup View (/dashboard/[id])

**Component: PendingNameserversView**
- Displays when status is 'pending_ns'
- Shows warning banner: "Action Required"
- Large, copy-paste friendly nameserver display with copy icons
- Clear instructions for registrar update
- "Verify Setup" button triggers verifyProjectStatus (new function)
- Loading spinner during verification
- Error handling for 401/403 Cloudflare API errors (displays "Auth Error")

**Component: ProtectedView**
- Displays when status is 'protected'
- Success banner: "Site is Live & Secure"
- Secret key display in obscured format (gk_live_••••)
- Copy button for full secret key
- "View Integration Code" button linking to integration page
- Integration code snippet showing curl example with X-Partner-Key header
- Displays domain and secret key in example
- Confetti animation on successful verification transition

## Data Models

### Project Model

```typescript
interface Project {
  id: string;
  user_id: string;
  name: string;
  zone_id: string | null;
  nameservers: string[] | null;
  status: 'pending_ns' | 'active' | 'protected';
  secret_key: string;
  created_at: string;
}
```

### Cloudflare Zone Response

```typescript
interface CloudflareZoneResponse {
  success: boolean;
  result: {
    id: string;
    name: string;
    nameservers: string[];
    status: string;
  };
}
```

### WAF Skip Rule Payload

```typescript
interface WAFSkipRule {
  description: string;
  expression: string;
  action: 'skip';
  action_parameters: {
    ruleset: 'current';
    phases: string[];
  };
  enabled: boolean;
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Secret Key Uniqueness

*For any* collection of projects created, all generated secret keys SHALL be unique and distinct from one another.

**Validates: Requirements 1.3**

### Property 2: Domain Registration Creates Valid Project

*For any* valid domain name submitted to registerDomain, the system SHALL create a project record with status 'pending_ns', a non-empty secret_key, and non-empty nameservers array.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 3: User Project Isolation

*For any* query for projects by a user, the system SHALL only return projects where the user_id matches the authenticated user's ID, regardless of how many projects exist in the database.

**Validates: Requirements 7.2, 7.3**

### Property 4: Status Transition Validity

*For any* project with status 'pending_ns', calling verifyAndConfigure when the Cloudflare zone is active SHALL transition the status to 'protected', and calling it when the zone is not active SHALL maintain the status as 'pending_ns'.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 5: Secret Key Persistence

*For any* project, once the secret_key is generated and stored, subsequent database queries SHALL return the identical secret_key value without modification.

**Validates: Requirements 1.3, 5.2**

### Property 6: Nameserver Consistency

*For any* project created via registerDomain, the nameservers stored in the database SHALL match the nameservers returned by the Cloudflare API response.

**Validates: Requirements 1.4, 2.1**

### Property 7: Project Data Completeness

*For any* project stored in the database, all required fields (id, user_id, name, status, secret_key, created_at) SHALL be present and non-null.

**Validates: Requirements 7.1**

### Property 8: WAF Skip Rule Expression Correctness for Valid Partner Key

*For any* request with the X-Partner-Key header value matching the project's secret_key, the WAF skip rule expression SHALL evaluate to true, triggering the skip action to bypass Super Bot Fight Mode and Rate Limiting phases.

**Validates: Requirements 4.3, 10.2, 10.4**

### Property 9: WAF Skip Rule Expression Correctness for Invalid Partner Key

*For any* request without the X-Partner-Key header or with an incorrect header value, the WAF skip rule expression SHALL evaluate to false, allowing normal bot protection rules to apply.

**Validates: Requirements 4.4, 4.5, 10.3, 10.5**

### Property 10: Skip Rule Configuration

*For any* project with status 'protected', the deployed WAF skip rule SHALL contain the X-Partner-Key header validation expression and skip action parameters targeting http_request_sbfm and http_ratelimit phases.

**Validates: Requirements 4.1, 4.2**

### Property 11: Database Consistency After Update

*For any* project status update operation, the database SHALL reflect the new status immediately on subsequent queries without delay or inconsistency.

**Validates: Requirements 7.4**

### Property 12: Secret Key Obscuration

*For any* secret_key displayed in the UI, the obscured format SHALL show only the prefix (e.g., "gk_live_") followed by bullet points, with the full key accessible only via copy button.

**Validates: Requirements 5.2**

### Property 13: Integration Snippet Correctness

*For any* protected project, the displayed integration code snippet SHALL contain the correct domain name and the project's secret_key in the curl command example using the X-Partner-Key header.

**Validates: Requirements 5.5**

### Property 14: Project Card Display

*For any* project displayed on the dashboard, the card SHALL show the domain name and current status badge, with status badges colored yellow for 'pending_ns' and green for 'protected'.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 15: User Authorization on Access

*For any* project access attempt, the system SHALL verify that the requesting user's ID matches the project's user_id, rejecting access if they do not match.

**Validates: Requirements 7.5**

### Property 16: Verification Status Response Correctness

*For any* call to verifyProjectStatus with a pending Cloudflare zone, the system SHALL return status 'pending_ns' with message 'Waiting for Nameserver update.', and for any active zone, it SHALL return status 'protected' with message 'Domain active & Firewall injected.'

**Validates: Requirements 9.3, 9.5**

### Property 17: Status Badge Display Correctness

*For any* project card displayed on the dashboard, projects with status 'pending_ns' SHALL display "⚠ Pending Setup" and projects with status 'protected' SHALL display "✅ Secure & Active".

**Validates: Requirements 6.3, 6.4**

### Property 18: Verification Module Data Retrieval

*For any* project passed to verifyProjectStatus, the system SHALL successfully retrieve zone_id, api_token, and secret_key from the database before proceeding with Cloudflare API calls.

**Validates: Requirements 9.2**

## Error Handling

### Cloudflare API Errors

- **Zone Creation Failure**: Return error message to user, do not create database record
- **Zone Status Check Failure**: Return pending status with retry message
- **WAF Skip Rule Deployment Failure**: Log error, return error message, maintain 'active' status (not 'protected')

### Database Errors

- **Project Not Found**: Return 404 error
- **User Ownership Violation**: Return 403 Forbidden
- **Duplicate Domain**: Check for existing zone_id before creation, return error if found

### Validation Errors

- **Invalid Domain Format**: Validate domain before API call, return validation error
- **Missing Environment Variables**: Fail fast at server startup with clear error message

## Testing Strategy

### Unit Testing

Unit tests verify specific examples and edge cases:

- Domain validation (valid domains, invalid formats, edge cases)
- Secret key generation (correct length, uniqueness)
- User ownership verification (correct user, wrong user, missing user)
- Status transitions (valid transitions, invalid transitions)
- Nameserver extraction from API responses
- Error handling for API failures

### Property-Based Testing

Property-based tests verify universal properties using fast-check library:

- **Property 1**: Generate random project pairs, verify secret keys are unique
- **Property 2**: Generate random user IDs and projects, verify isolation
- **Property 3**: Generate status transitions, verify only valid transitions occur
- **Property 4**: Generate projects, verify secret key persistence across queries
- **Property 5**: Generate Cloudflare responses, verify nameserver consistency
- **Property 6**: Generate requests with various X-Partner-Key headers, verify WAF skip expression logic
- **Property 7**: Generate partner key scenarios, verify skip action triggers correctly
- **Property 8**: Generate status updates, verify database consistency

### Testing Framework

- **Unit Tests**: Jest with TypeScript support
- **Property-Based Tests**: fast-check library with minimum 100 iterations per property
- **Test Location**: Co-located with source files using `.test.ts` suffix
- **Coverage Target**: Core business logic and critical paths

### Test Annotation Requirements

Each property-based test MUST include:
```typescript
// **Feature: gatekeeper-bot-firewall, Property {number}: {property_text}**
// **Validates: Requirements X.Y**
```

### Integration Testing

- End-to-end flow: domain registration → nameserver verification → protection activation
- Cloudflare API mocking for consistent test behavior
- Database transaction rollback for test isolation
