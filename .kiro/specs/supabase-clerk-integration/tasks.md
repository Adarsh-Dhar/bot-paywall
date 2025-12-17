# Implementation Plan: Supabase & Clerk Integration

## Overview

This implementation plan converts the feature design into actionable coding tasks. Each task builds incrementally on previous tasks, with no orphaned code. Tasks are sequenced to validate core functionality early through automated tests.

---

## Core Implementation Tasks

- [x] 1. Set up project structure and environment configuration
  - Create `app/actions/` directory for server actions
  - Create `app/dashboard/` directory structure for dashboard pages
  - Set up environment variables in `.env.local` (CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
  - Install required dependencies: `@clerk/nextjs`, `@supabase/supabase-js`, `bcryptjs`, `fast-check` (for property testing)
  - _Requirements: 1.1, 7.1_

- [x] 2. Set up Clerk authentication and middleware
  - Create `middleware.ts` to protect `/dashboard/*` routes
  - Implement redirect logic: unauthenticated users → `/sign-in`, authenticated users → proceed
  - Implement post-signin redirect to `/dashboard`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.1 Write property tests for middleware authentication
  - **Property 1: Unauthenticated users are redirected to sign-in**
  - **Property 2: Authenticated users can access dashboard routes**
  - **Property 3: Post-signin redirect to dashboard**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 3. Set up Supabase database schema
  - Create `projects` table with columns: id (UUID), user_id (TEXT), name (TEXT), website_url (TEXT), requests_count (INT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)
  - Create index on `projects.user_id`
  - Create `api_keys` table with columns: id (UUID), project_id (UUID), key_hash (TEXT), prefix (TEXT), last_used (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
  - Create index on `api_keys.project_id`
  - Enable Row-Level Security (RLS) on both tables
  - Create RLS policy: users can only SELECT/INSERT/UPDATE rows where `user_id` matches their Clerk user ID
  - _Requirements: 2.1, 3.2, 6.1, 6.4_

- [x] 4. Implement core server actions
  - Create `app/actions/dashboard.ts` with the following functions:
    - `getProjects()`: Fetch all projects for current user, sorted by created_at DESC
    - `createProject(formData)`: Validate input, generate API key, hash with bcrypt, create project and api_key records
    - `getProject(projectId)`: Fetch single project with authorization check
    - `incrementUsage(projectId)`: Increment requests_count by random value (1-50)
  - Implement error handling for all functions (validation, authorization, database errors)
  - _Requirements: 2.1, 3.2, 3.3, 3.4, 3.7, 4.1, 5.1, 7.1, 7.2_

- [x] 4.1 Write property tests for server actions
  - **Property 4: Projects are filtered by user**
  - **Property 9: API key format is correct**
  - **Property 10: API keys are hashed before storage**
  - **Property 12: Project creation validates input**
  - **Property 13: Project creation succeeds with valid input**
  - **Property 14: API key hash is never exposed**
  - **Property 15: Cross-user access is prevented**
  - **Property 22: Server Actions require authentication**
  - **Property 23: Server Actions use no API routes**
  - **Property 24: Server Actions return data or errors**
  - **Validates: Requirements 2.1, 3.2, 3.3, 3.4, 3.7, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3**

- [x] 5. Implement dashboard page and components
  - Create `app/dashboard/page.tsx` component
  - Implement loading state with skeleton components
  - Implement empty state component with "Create Project" CTA
  - Implement Project Card component to display project name, website_url, created_at, and requests_count
  - Map over projects and render cards in reverse chronological order
  - Implement "Create Project" button to open modal
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5.1 Write property tests for dashboard display
  - **Property 5: Empty projects display empty state**
  - **Property 6: Projects are sorted by creation date**
  - **Property 7: Project data is complete in display**
  - **Property 20: Usage counter displays on dashboard**
  - **Validates: Requirements 2.2, 2.3, 2.4, 5.2**

- [x] 6. Implement create project modal
  - Create modal component with form fields: project name (required), website URL (optional)
  - Implement form validation: reject empty or whitespace-only names
  - On submit: call `createProject()` server action
  - On success: display raw API key in modal with "I have copied this" acknowledgment button
  - Prevent modal close until user acknowledges
  - On acknowledge: close modal and refresh projects list
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

- [x] 6.1 Write property tests for create project modal
  - **Property 8: Create project modal displays on button click**
  - **Property 11: Raw API key displayed exactly once**
  - **Validates: Requirements 3.1, 3.5, 3.6**

- [x] 7. Implement integration page
  - Create `app/dashboard/[id]/integrate.tsx` component
  - On mount: call `getProject(projectId)` server action
  - If error or unauthorized: display error message
  - If successful: display project name in header
  - Create code snippet components with project ID injected
  - Display CodeBlock components with syntax highlighting
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7.1 Write property tests for integration page
  - **Property 16: Integration page displays correct project**
  - **Property 17: Integration page handles invalid project ID**
  - **Property 18: Code snippets include project ID**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 8. Implement usage counter and dashboard refresh
  - Create Usage Graph component to display requests_count
  - On dashboard page load: call `incrementUsage()` for each project to simulate traffic
  - Update graph with new requests_count values
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 8.1 Write property tests for usage counter
  - **Property 19: Usage counter increments correctly**
  - **Property 21: Usage counter persists**
  - **Validates: Requirements 5.1, 5.3**

- [x] 9. Checkpoint - Ensure all tests pass
  - Run all unit tests and property-based tests
  - Verify 100% coverage for server actions, validation logic, authorization checks, and data filtering
  - Ask the user if questions arise

- [x] 10. Write integration tests
  - Test full flow: authenticate → create project → view integration page
  - Test middleware redirects for unauthenticated users
  - Test cross-user data isolation
  - Test database persistence across multiple operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.2, 4.1, 6.3, 6.4_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

