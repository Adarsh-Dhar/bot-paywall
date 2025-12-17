# Implementation Plan: Gatekeeper Bot Firewall

- [x] 1. Set up project structure and database schema
  - Create Supabase migration for projects table with all required columns
  - Define TypeScript types for Project model and API responses
  - Set up environment variables for Cloudflare API credentials
  - _Requirements: 7.1_

- [x] 2. Implement core server actions for domain registration
  - [x] 2.1 Create registerDomain server action
    - Validate domain format before API call
    - Generate 32-character secret key using UUID
    - Call Cloudflare API to create zone
    - Extract zone_id and nameservers from response
    - Insert project record into database with status 'pending_ns'
    - Return success response with nameservers
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for secret key uniqueness
    - **Feature: gatekeeper-bot-firewall, Property 1: Secret Key Uniqueness**
    - **Validates: Requirements 1.3**

  - [x] 2.3 Write property test for domain registration
    - **Feature: gatekeeper-bot-firewall, Property 2: Domain Registration Creates Valid Project**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 2.4 Write unit tests for registerDomain
    - Test valid domain registration
    - Test invalid domain format rejection
    - Test Cloudflare API error handling
    - Test database insertion
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 3. Implement verification and WAF deployment
  - [x] 3.1 Create verifyAndConfigure server action
    - Fetch project from database and verify user ownership
    - Call Cloudflare API to check zone status
    - If zone is not active, return pending status
    - If zone is active, deploy WAF rule via Cloudflare API
    - Update project status to 'protected' in database
    - Return success or error response
    - _Requirements: 3.1, 3.3, 3.4, 4.1_

  - [x] 3.2 Write property test for status transition validity
    - **Feature: gatekeeper-bot-firewall, Property 4: Status Transition Validity**
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x] 3.3 Write property test for WAF rule expression correctness (valid password)
    - **Feature: gatekeeper-bot-firewall, Property 8: WAF Rule Expression Correctness for Valid Password**
    - **Validates: Requirements 4.4, 8.2, 8.4**

  - [x] 3.4 Write property test for WAF rule expression correctness (invalid password)
    - **Feature: gatekeeper-bot-firewall, Property 9: WAF Rule Expression Correctness for Invalid Password**
    - **Validates: Requirements 4.3, 8.3, 8.5**

  - [x] 3.5 Write unit tests for verifyAndConfigure
    - Test zone status check
    - Test pending zone handling
    - Test WAF rule deployment
    - Test status update
    - Test user authorization
    - _Requirements: 3.1, 3.3, 3.4, 4.1_

- [x] 4. Implement database query and authorization functions
  - [x] 4.1 Create getProjectsByUser function
    - Query projects table filtered by user_id
    - Return all projects for authenticated user
    - _Requirements: 6.1, 7.3_

  - [x] 4.2 Create getProjectById function with authorization
    - Fetch project by ID
    - Verify requesting user owns the project
    - Return project or throw authorization error
    - _Requirements: 7.5_

  - [x] 4.3 Write property test for user project isolation
    - **Feature: gatekeeper-bot-firewall, Property 3: User Project Isolation**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 4.4 Write property test for user authorization on access
    - **Feature: gatekeeper-bot-firewall, Property 15: User Authorization on Access**
    - **Validates: Requirements 7.5**

  - [x] 4.5 Write unit tests for database queries
    - Test getProjectsByUser returns only user's projects
    - Test getProjectById with correct user
    - Test getProjectById with wrong user (authorization failure)
    - _Requirements: 6.1, 7.3, 7.5_

- [x] 5. Implement frontend dashboard page
  - [x] 5.1 Create Dashboard page component (/dashboard)
    - Fetch all projects for authenticated user
    - Display projects in responsive grid layout
    - Show domain name and status badge for each project
    - Implement "Add New Domain" button
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Create ProjectCard component
    - Display domain name
    - Display status badge (yellow for pending_ns, green for protected)
    - Make card clickable to navigate to project setup view
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 5.3 Write property test for project card display
    - **Feature: gatekeeper-bot-firewall, Property 14: Project Card Display**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x] 5.4 Write unit tests for dashboard components
    - Test project grid rendering
    - Test status badge colors
    - Test navigation on card click
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Implement domain registration modal
  - [x] 6.1 Create CreateProjectModal component
    - Display modal with domain input field
    - Validate domain format on input
    - Submit button triggers registerDomain action
    - Show loading state during API call
    - Handle and display errors
    - Close modal and refresh project list on success
    - _Requirements: 1.1, 1.2_

  - [x] 6.2 Write unit tests for CreateProjectModal
    - Test modal rendering
    - Test domain validation
    - Test form submission
    - Test error handling
    - Test success flow
    - _Requirements: 1.1, 1.2_

- [x] 7. Implement setup view for pending nameservers
  - [x] 7.1 Create PendingNameserversView component
    - Display warning banner "Action Required"
    - Show nameservers in large, copy-paste friendly format
    - Display clear instructions for registrar update
    - Show "I have updated them, Verify Now" button
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.2 Create nameserver display utility
    - Format nameservers for easy copying
    - Provide copy-to-clipboard functionality
    - _Requirements: 2.1, 2.2_

  - [x] 7.3 Write unit tests for PendingNameserversView
    - Test warning banner display
    - Test nameserver rendering
    - Test instruction text presence
    - Test verify button functionality
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8. Implement setup view for protected projects
  - [x] 8.1 Create ProtectedView component
    - Display success banner "Site is Live & Secure"
    - Show secret key in obscured format (gk_live_••••)
    - Provide copy button for full secret key
    - Display integration code snippet
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Create secret key obscuration utility
    - Take full secret key and return obscured version
    - Ensure prefix is visible (gk_live_)
    - Replace rest with bullet points
    - _Requirements: 5.2_

  - [x] 8.3 Create integration snippet component
    - Generate curl command with domain and secret key
    - Display code block with syntax highlighting
    - Provide copy button for snippet
    - _Requirements: 5.4, 5.5_

  - [x] 8.4 Write property test for secret key obscuration
    - **Feature: gatekeeper-bot-firewall, Property 12: Secret Key Obscuration**
    - **Validates: Requirements 5.2**

  - [x] 8.5 Write property test for integration snippet correctness
    - **Feature: gatekeeper-bot-firewall, Property 13: Integration Snippet Correctness**
    - **Validates: Requirements 5.5**

  - [x] 8.6 Write unit tests for ProtectedView
    - Test success banner display
    - Test secret key obscuration
    - Test copy button functionality
    - Test integration snippet rendering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Implement project setup page routing
  - [x] 9.1 Create setup page component (/dashboard/[id])
    - Fetch project by ID with authorization
    - Render PendingNameserversView if status is 'pending_ns'
    - Render ProtectedView if status is 'protected'
    - Handle loading and error states
    - _Requirements: 2.1, 5.1_

  - [x] 9.2 Implement "Verify Now" button handler
    - Call verifyAndConfigure action
    - Show loading state during verification
    - Handle success and error responses
    - Refresh project data on success
    - _Requirements: 3.1_

  - [x] 9.3 Write unit tests for setup page
    - Test project fetching
    - Test authorization check
    - Test conditional rendering based on status
    - Test verify button functionality
    - _Requirements: 2.1, 5.1, 3.1_

- [x] 10. Implement additional property tests for data consistency
  - [x] 10.1 Write property test for secret key persistence
    - **Feature: gatekeeper-bot-firewall, Property 5: Secret Key Persistence**
    - **Validates: Requirements 1.3, 5.2**

  - [x] 10.2 Write property test for nameserver consistency
    - **Feature: gatekeeper-bot-firewall, Property 6: Nameserver Consistency**
    - **Validates: Requirements 1.4, 2.1**

  - [x] 10.3 Write property test for project data completeness
    - **Feature: gatekeeper-bot-firewall, Property 7: Project Data Completeness**
    - **Validates: Requirements 7.1**

  - [x] 10.4 Write property test for WAF rule configuration
    - **Feature: gatekeeper-bot-firewall, Property 10: Bot Detection Rule Configuration**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 10.5 Write property test for database consistency after update
    - **Feature: gatekeeper-bot-firewall, Property 11: Database Consistency After Update**
    - **Validates: Requirements 7.4**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement error handling and edge cases
  - [x] 12.1 Add error handling for Cloudflare API failures
    - Handle zone creation failures
    - Handle zone status check failures
    - Handle WAF rule deployment failures
    - Return appropriate error messages to UI
    - _Requirements: 1.5, 3.5_

  - [x] 12.2 Add validation for domain format
    - Validate domain before API call
    - Reject invalid domain formats
    - Return validation error to user
    - _Requirements: 1.2_

  - [x] 12.3 Add environment variable validation
    - Check for CLOUDFLARE_API_TOKEN at startup
    - Check for CLOUDFLARE_ACCOUNT_ID at startup
    - Fail fast with clear error message if missing
    - _Requirements: 1.2, 3.1_

  - [x] 12.4 Write unit tests for error handling
    - Test Cloudflare API error scenarios
    - Test domain validation errors
    - Test missing environment variables
    - _Requirements: 1.5, 3.5, 1.2_

- [x] 13. Implement middleware and authentication
  - [x] 13.1 Ensure Clerk authentication on protected routes
    - Verify middleware protects /dashboard routes
    - Verify user_id is available in server actions
    - _Requirements: 7.2, 7.3_

  - [x] 13.2 Add user_id to server action context
    - Extract user_id from Clerk session
    - Pass to database queries for filtering
    - _Requirements: 7.2, 7.3_

  - [x] 13.3 Write unit tests for authentication
    - Test protected route access
    - Test user_id extraction
    - _Requirements: 7.2, 7.3_

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration testing
  - [x] 15.1 Test end-to-end flow: registration → verification → protection
    - Create project via registerDomain
    - Verify project appears on dashboard
    - Call verifyAndConfigure with active zone
    - Verify project status updates to protected
    - Verify protected view displays correctly
    - _Requirements: 1.2, 1.4, 6.1, 3.3, 3.4, 5.1_

  - [x] 15.2 Write integration tests
    - Test complete user flow from registration to protection
    - Test error scenarios in flow
    - _Requirements: 1.2, 1.4, 6.1, 3.3, 3.4, 5.1_

- [x] 16. Final Checkpoint - All tests passing
  - Ensure all tests pass, ask the user if questions arise.
