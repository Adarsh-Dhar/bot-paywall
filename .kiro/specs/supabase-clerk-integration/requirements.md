# Requirements Document: Supabase & Clerk Integration

## Introduction

This feature integrates Supabase (PostgreSQL database) and Clerk (authentication) into an existing Next.js 14 dashboard application. The system will enable users to authenticate via Clerk, manage projects in Supabase, generate API keys, and track usage metrics. The application transitions from hardcoded mock data to a fully functional backend-connected system while preserving all existing UI components and styling.

## Glossary

- **Clerk**: Authentication provider handling user sign-up, sign-in, and session management
- **Supabase**: PostgreSQL database service providing data persistence
- **Project**: A user-owned resource representing a bot paywall configuration
- **API Key**: A unique credential (prefixed with `gk_live_`) used to authenticate requests; only shown once at creation
- **User ID**: Clerk's unique identifier for an authenticated user
- **Server Action**: Next.js 14 server-side function callable from client components
- **Middleware**: Next.js middleware protecting routes and enforcing authentication
- **Usage Counter**: Simulated request count incremented on dashboard refresh to represent bot traffic

## Requirements

### Requirement 1

**User Story:** As an unauthenticated user, I want to be redirected to a sign-in page when accessing protected routes, so that only authenticated users can access the dashboard.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to `/dashboard` THEN the system SHALL redirect them to `/sign-in`
2. WHEN an unauthenticated user navigates to `/dashboard/[id]/integrate` THEN the system SHALL redirect them to `/sign-in`
3. WHEN a user successfully signs in via Clerk THEN the system SHALL redirect them to `/dashboard`
4. WHEN a user is authenticated THEN the system SHALL allow access to all `/dashboard/*` routes without redirection

### Requirement 2

**User Story:** As an authenticated user, I want to see all my projects on the dashboard, so that I can manage and view my bot paywall configurations.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/dashboard` THEN the system SHALL fetch and display all projects where `user_id` matches the current Clerk user ID
2. WHEN the projects list is empty THEN the system SHALL display an empty state component with a call-to-action to create a project
3. WHEN projects exist THEN the system SHALL display each project using the Project Card component with real data (name, website_url, created_at)
4. WHEN a user views the projects list THEN the system SHALL display projects in reverse chronological order (newest first)

### Requirement 3

**User Story:** As an authenticated user, I want to create a new project with a name and optional website URL, so that I can set up a new bot paywall.

#### Acceptance Criteria

1. WHEN a user clicks the "Create Project" button THEN the system SHALL display a modal form with fields for project name and website URL
2. WHEN a user submits the form with a valid project name THEN the system SHALL create a new project in the database and generate a unique API key
3. WHEN a project is created THEN the system SHALL generate a random 32-character API key prefixed with `gk_live_`
4. WHEN an API key is generated THEN the system SHALL hash the key using bcrypt and store only the hash in the database
5. WHEN a project is successfully created THEN the system SHALL display the raw (unhashed) API key in a modal dialog exactly once
6. WHEN the API key is displayed THEN the system SHALL prevent the dialog from closing until the user acknowledges "I have copied this"
7. WHEN a user attempts to create a project with an empty or whitespace-only name THEN the system SHALL reject the submission and display a validation error

### Requirement 4

**User Story:** As an authenticated user viewing a project's integration page, I want to see the project name and dynamic code snippets with my project ID, so that I can integrate the bot paywall into my application.

#### Acceptance Criteria

1. WHEN a user navigates to `/dashboard/[id]/integrate` THEN the system SHALL fetch the project with the matching ID and display its name in the header
2. WHEN a user navigates to `/dashboard/[id]/integrate` with an invalid project ID THEN the system SHALL display an error message
3. WHEN code snippets are displayed THEN the system SHALL inject the project ID into the code examples so users can copy-paste valid code
4. WHEN a user views the integration page THEN the system SHALL display code snippets in a CodeBlock component with syntax highlighting

### Requirement 5

**User Story:** As an authenticated user, I want to see simulated usage metrics on my dashboard, so that I can understand bot traffic patterns for my paywalls.

#### Acceptance Criteria

1. WHEN a user refreshes the dashboard THEN the system SHALL increment the `requests_count` for each project by a random value between 1 and 50
2. WHEN a user views the dashboard THEN the system SHALL display the current `requests_count` for each project in the usage graph component
3. WHEN the requests_count is incremented THEN the system SHALL persist the updated value to the database

### Requirement 6

**User Story:** As a system, I want to ensure data integrity and security, so that user data is protected and API keys are never exposed in logs or responses except at creation.

#### Acceptance Criteria

1. WHEN an API key is stored THEN the system SHALL store only the bcrypt hash, never the raw key
2. WHEN a user queries project data THEN the system SHALL never return the API key hash in the response
3. WHEN a user attempts to access another user's project THEN the system SHALL reject the request and return an error
4. WHEN the database is queried THEN the system SHALL filter results by the current user's Clerk user ID to prevent cross-user data access

### Requirement 7

**User Story:** As a developer, I want the application to use Server Actions for all data operations, so that the system is secure and follows Next.js 14 best practices.

#### Acceptance Criteria

1. WHEN data is fetched or modified THEN the system SHALL use Next.js Server Actions (not API routes) for all database operations
2. WHEN a Server Action is called THEN the system SHALL validate the current user's authentication status before executing
3. WHEN a Server Action completes THEN the system SHALL return data or errors to the client component
