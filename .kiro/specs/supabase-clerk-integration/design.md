# Design Document: Supabase & Clerk Integration

## Overview

This design outlines the integration of Supabase (PostgreSQL) and Clerk (authentication) into an existing Next.js 14 dashboard application. The system enables authenticated users to manage projects, generate API keys, and view usage metrics. All data operations use Next.js Server Actions for security and maintainability. The existing UI components and styling remain unchanged; only the data layer and authentication are modified.

## Architecture

### High-Level Flow

```
User Browser
    ↓
Next.js 14 App Router (Client & Server Components)
    ↓
Middleware (Route Protection)
    ↓
Clerk (Authentication)
    ↓
Server Actions (Data Logic)
    ↓
Supabase PostgreSQL (Data Persistence)
```

### Key Design Decisions

1. **Server Actions Only**: All data operations (fetch, create, update) use Next.js Server Actions. No API routes are created unless necessary for external integrations.
2. **Clerk for Auth**: Clerk handles all authentication. Middleware protects `/dashboard/*` routes.
3. **Bcrypt for Key Hashing**: API keys are hashed using bcrypt before storage. Raw keys are shown only once at creation.
4. **Row-Level Security (RLS)**: Supabase RLS policies ensure users can only access their own data.
5. **Simulated Usage**: A `requests_count` field is incremented randomly on dashboard refresh to simulate bot traffic.

## Components and Interfaces

### 1. Middleware (`middleware.ts`)

**Purpose**: Protect `/dashboard/*` routes and redirect unauthenticated users to `/sign-in`.

**Behavior**:
- Intercepts requests to `/dashboard/*`
- Checks Clerk authentication status
- Redirects to `/sign-in` if unauthenticated
- Allows authenticated users to proceed

### 2. Server Actions (`app/actions/dashboard.ts`)

**Purpose**: Handle all data operations (fetch, create, update).

**Functions**:

#### `getProjects()`
- **Input**: None (uses current Clerk user from context)
- **Output**: Array of projects or error
- **Logic**:
  - Fetch current user ID from Clerk
  - Query Supabase for all projects where `user_id` matches
  - Return projects sorted by `created_at` DESC
  - Handle errors gracefully

#### `createProject(formData: FormData)`
- **Input**: FormData with `name` and optional `website_url`
- **Output**: Object with `success`, `projectId`, `apiKey` (raw), or `error`
- **Logic**:
  - Validate input (name is non-empty, not whitespace-only)
  - Fetch current user ID from Clerk
  - Generate random 32-char API key prefixed with `gk_live_`
  - Hash the key using bcrypt
  - Insert project into `projects` table
  - Insert hashed key into `api_keys` table
  - Return raw API key (only time it's shown)
  - Handle errors (validation, database)

#### `getProject(projectId: string)`
- **Input**: Project ID
- **Output**: Project object or error
- **Logic**:
  - Fetch current user ID from Clerk
  - Query Supabase for project with matching ID
  - Verify user owns the project (user_id matches)
  - Return project data
  - Handle errors (unauthorized, not found)

#### `incrementUsage(projectId: string)`
- **Input**: Project ID
- **Output**: Updated `requests_count` or error
- **Logic**:
  - Verify user owns the project
  - Generate random increment (1-50)
  - Update `requests_count` in projects table
  - Return new count
  - Handle errors (unauthorized, not found)

### 3. Database Schema (Supabase)

#### Table: `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  requests_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
```

#### Table: `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
```

#### Row-Level Security (RLS)
- Enable RLS on both tables
- Policy: Users can only SELECT/INSERT/UPDATE rows where `user_id` matches their Clerk user ID
- Policy: Users cannot DELETE projects (soft delete only, if needed)

### 4. Client Components

#### Dashboard Page (`app/dashboard/page.tsx`)
- **State**: Projects list, loading state, error state
- **Behavior**:
  - On mount: Call `getProjects()` server action
  - Display loading skeleton while fetching
  - If empty: Show empty state component with "Create Project" CTA
  - If data: Map over projects and render Project Card components
  - On "Create Project" click: Open create modal

#### Create Project Modal
- **State**: Form data (name, website_url), loading, error, API key display
- **Behavior**:
  - Form validation (name required, not whitespace)
  - On submit: Call `createProject()` server action
  - On success: Display API key in modal with "I have copied this" acknowledgment
  - Prevent modal close until acknowledged
  - On acknowledge: Close modal and refresh projects list

#### Integration Page (`app/dashboard/[id]/integrate.tsx`)
- **State**: Project data, loading, error
- **Behavior**:
  - On mount: Call `getProject(projectId)` server action to fetch project by ID
  - If project not found or unauthorized: Display error message
  - If successful: Display project name in header
  - Inject project ID into code snippets
  - Display CodeBlock components with syntax highlighting

#### Usage Graph Component
- **State**: requests_count
- **Behavior**:
  - Display current requests_count
  - On dashboard refresh: Call `incrementUsage()` to simulate traffic
  - Update graph with new count

### 5. Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

## Data Models

### Project
```typescript
interface Project {
  id: string;           // UUID
  user_id: string;      // Clerk user ID
  name: string;
  website_url?: string;
  requests_count: number;
  created_at: string;   // ISO timestamp
  updated_at: string;   // ISO timestamp
}
```

### API Key (Storage Only)
```typescript
interface ApiKeyRecord {
  id: string;           // UUID
  project_id: string;   // UUID
  key_hash: string;     // bcrypt hash
  prefix: string;       // e.g., "gk_live_"
  last_used?: string;   // ISO timestamp
  created_at: string;   // ISO timestamp
}
```

### API Key (Creation Response)
```typescript
interface CreateProjectResponse {
  success: boolean;
  projectId?: string;
  apiKey?: string;      // Raw key, shown only once
  error?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unauthenticated users are redirected to sign-in
*For any* unauthenticated user attempting to access `/dashboard` or `/dashboard/[id]/integrate`, the middleware SHALL redirect them to `/sign-in`.
**Validates: Requirements 1.1, 1.2**

### Property 2: Authenticated users can access dashboard routes
*For any* authenticated user, accessing `/dashboard` or `/dashboard/[id]/integrate` SHALL succeed without redirection.
**Validates: Requirements 1.4**

### Property 3: Post-signin redirect to dashboard
*For any* user who successfully authenticates via Clerk, the system SHALL redirect them to `/dashboard`.
**Validates: Requirements 1.3**

### Property 4: Projects are filtered by user
*For any* authenticated user, the `getProjects()` server action SHALL return only projects where `user_id` matches the current Clerk user ID.
**Validates: Requirements 2.1, 6.4**

### Property 5: Empty projects display empty state
*For any* authenticated user with no projects, the dashboard SHALL display an empty state component with a call-to-action to create a project.
**Validates: Requirements 2.2**

### Property 6: Projects are sorted by creation date
*For any* set of projects, when displayed on the dashboard, they SHALL be ordered in reverse chronological order (newest first) by `created_at`.
**Validates: Requirements 2.4**

### Property 7: Project data is complete in display
*For any* project displayed in a Project Card component, the rendered output SHALL include the project name, website_url (if present), and created_at timestamp.
**Validates: Requirements 2.3**

### Property 8: Create project modal displays on button click
*For any* user clicking the "Create Project" button, the system SHALL display a modal form with fields for project name and website URL.
**Validates: Requirements 3.1**

### Property 9: API key format is correct
*For any* newly created project, the generated API key SHALL be exactly 32 characters long and start with the prefix `gk_live_`.
**Validates: Requirements 3.3**

### Property 10: API keys are hashed before storage
*For any* API key generated and stored, the stored `key_hash` in the database SHALL be a valid bcrypt hash and SHALL NOT match the raw API key.
**Validates: Requirements 3.4, 6.1**

### Property 11: Raw API key displayed exactly once
*For any* successful project creation, the raw (unhashed) API key SHALL be displayed in a modal dialog exactly once, and the dialog SHALL prevent closing until the user acknowledges "I have copied this".
**Validates: Requirements 3.5, 3.6**

### Property 12: Project creation validates input
*For any* form submission with an empty or whitespace-only project name, the `createProject()` server action SHALL reject the submission and return a validation error.
**Validates: Requirements 3.7**

### Property 13: Project creation succeeds with valid input
*For any* form submission with a non-empty, non-whitespace project name, the `createProject()` server action SHALL create a new project in the database and return the raw API key.
**Validates: Requirements 3.2**

### Property 14: API key hash is never exposed
*For any* query of project data via the `getProjects()` server action, the response SHALL NOT include the `key_hash` field.
**Validates: Requirements 6.2**

### Property 15: Cross-user access is prevented
*For any* authenticated user attempting to access another user's project via `getProjects()` or `incrementUsage()`, the system SHALL reject the request and return an error.
**Validates: Requirements 6.3, 6.4**

### Property 16: Integration page displays correct project
*For any* valid project ID in the URL `/dashboard/[id]/integrate`, the page SHALL fetch and display the project name in the header.
**Validates: Requirements 4.1**

### Property 17: Integration page handles invalid project ID
*For any* invalid project ID in the URL `/dashboard/[id]/integrate`, the system SHALL display an error message.
**Validates: Requirements 4.2**

### Property 18: Code snippets include project ID
*For any* code snippet displayed on the integration page, the rendered code SHALL include the project ID injected as a valid value.
**Validates: Requirements 4.3**

### Property 19: Usage counter increments correctly
*For any* dashboard refresh, the `requests_count` for each project SHALL be incremented by a random value between 1 and 50 (inclusive).
**Validates: Requirements 5.1**

### Property 20: Usage counter displays on dashboard
*For any* project displayed on the dashboard, the current `requests_count` SHALL be visible in the usage graph component.
**Validates: Requirements 5.2**

### Property 21: Usage counter persists
*For any* increment to `requests_count`, the updated value SHALL be persisted to the database and reflected on subsequent queries.
**Validates: Requirements 5.3**

### Property 22: Server Actions require authentication
*For any* Server Action call without a valid Clerk authentication context, the action SHALL fail and return an authentication error.
**Validates: Requirements 7.2**

### Property 23: Server Actions use no API routes
*For any* data operation (fetch, create, update), the system SHALL use Next.js Server Actions exclusively and SHALL NOT use API routes for these operations.
**Validates: Requirements 7.1**

### Property 24: Server Actions return data or errors
*For any* Server Action completion, the system SHALL return either data or an error object to the client component.
**Validates: Requirements 7.3**

## Error Handling

### Authentication Errors
- **Unauthenticated Access**: Middleware redirects to `/sign-in`
- **Invalid Session**: Server Actions return 401 error
- **Expired Token**: Clerk handles refresh; middleware re-checks

### Database Errors
- **Connection Failure**: Return generic error to client; log details server-side
- **Constraint Violation**: Return validation error (e.g., duplicate name)
- **Row Not Found**: Return 404 error with descriptive message

### Validation Errors
- **Empty Project Name**: Return validation error with message "Project name is required"
- **Whitespace-Only Name**: Return validation error with message "Project name cannot be empty"
- **Invalid Project ID**: Return 404 error on integration page

### Authorization Errors
- **Cross-User Access**: Return 403 error "Unauthorized to access this project"
- **Missing User Context**: Return 401 error "User context not found"

## Testing Strategy

### Unit Testing
- Test `getProjects()` with various user IDs and project counts
- Test `createProject()` with valid and invalid inputs
- Test `incrementUsage()` with valid and invalid project IDs
- Test API key generation format and bcrypt hashing
- Test input validation (empty, whitespace, special characters)

### Property-Based Testing
- **Property 1-16**: Each property SHALL be implemented as a separate property-based test
- **Test Framework**: Jest with fast-check for property generation
- **Minimum Iterations**: 100 iterations per property test
- **Test Annotation**: Each test SHALL include a comment referencing the property number and requirements

### Integration Testing
- Test middleware redirects for unauthenticated users
- Test full flow: authenticate → create project → view integration page
- Test cross-user data isolation
- Test database persistence across multiple operations

### Test Coverage Goals
- All Server Actions: 100% coverage
- All validation logic: 100% coverage
- All authorization checks: 100% coverage
- All data filtering: 100% coverage
