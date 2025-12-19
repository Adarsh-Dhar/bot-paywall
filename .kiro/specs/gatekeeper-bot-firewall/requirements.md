# Requirements Document: Gatekeeper Bot Firewall

## Introduction

Gatekeeper is a SaaS dashboard that enables users to protect their domains from bot traffic through Cloudflare integration. Users can register a domain, which automatically creates a Cloudflare Zone and deploys a custom WAF rule that blocks bots unless they provide a specific secret password (the "backdoor"). The system manages the complete lifecycle from domain registration through nameserver verification to active protection.

## Glossary

- **Domain**: A user's website domain (e.g., "startup.com")
- **Cloudflare Zone**: A Cloudflare account resource representing a domain
- **Zone ID**: Unique identifier for a Cloudflare Zone
- **Nameservers**: DNS servers that route domain traffic (provided by Cloudflare)
- **Secret Key**: A unique 32-character password (e.g., "CLIENT_SECRET_123") that allows applications to bypass bot protection
- **WAF Skip Rule**: Web Application Firewall rule that skips protection phases for authorized requests
- **X-Partner-Key Header**: HTTP header containing the secret key for bypassing bot protection
- **Super Bot Fight Mode**: Cloudflare's advanced bot detection and mitigation system (phase: http_request_sbfm)
- **Rate Limiting**: Cloudflare's request rate limiting protection (phase: http_ratelimit)
- **Partner Key**: The mechanism allowing authorized applications to bypass protection using the X-Partner-Key header
- **Project**: A user's domain protection configuration stored in the database

## Requirements

### Requirement 1

**User Story:** As a user, I want to register a new domain in Gatekeeper, so that I can begin protecting it from bot traffic.

#### Acceptance Criteria

1. WHEN a user clicks "Add New Domain" on the dashboard THEN the system SHALL display a modal with a domain input field
2. WHEN a user enters a valid domain name and submits the form THEN the system SHALL call the Cloudflare API to create a new zone
3. WHEN a Cloudflare zone is successfully created THEN the system SHALL generate a unique 32-character secret key and store it in the database
4. WHEN a zone is created THEN the system SHALL save the project record with status 'pending_ns' and store the Cloudflare nameservers
5. WHEN a zone creation fails THEN the system SHALL display an error message to the user and not create a database record

### Requirement 2

**User Story:** As a user, I want to see the nameservers I need to configure at my registrar, so that I can complete the domain setup process.

#### Acceptance Criteria

1. WHEN a user navigates to a project in pending_ns status THEN the system SHALL display a setup view with the project's nameservers
2. WHEN nameservers are displayed THEN the system SHALL present them in a large, copy-paste friendly format
3. WHEN nameservers are displayed THEN the system SHALL show clear instructions to update them at the domain registrar
4. WHEN a user views the setup page THEN the system SHALL display a warning banner indicating "Action Required"
5. WHEN nameservers are displayed THEN the system SHALL provide a button labeled "I have updated them, Verify Now"

### Requirement 3

**User Story:** As a user, I want to verify that my nameservers have been updated, so that I can activate protection on my domain.

#### Acceptance Criteria

1. WHEN a user clicks "Verify Now" THEN the system SHALL call the Cloudflare API to check the zone status
2. WHEN the zone status is not active THEN the system SHALL return a pending message and not update the project status
3. WHEN the zone status is active THEN the system SHALL proceed to deploy the WAF rule
4. WHEN verification succeeds THEN the system SHALL update the project status to 'protected'
5. WHEN verification fails THEN the system SHALL display an error message and maintain the current status

### Requirement 4

**User Story:** As a user, I want the firewall to automatically skip bot protection for requests with the correct partner key, so that my authorized applications can bypass bot detection entirely.

#### Acceptance Criteria

1. WHEN a zone becomes active THEN the system SHALL deploy a custom WAF skip rule to the Cloudflare zone targeting the http_request_firewall_custom phase
2. WHEN the WAF skip rule is deployed THEN the system SHALL configure it to detect requests with the X-Partner-Key header matching the secret key
3. WHEN a request contains the X-Partner-Key header with the correct secret key THEN the system SHALL skip the current ruleset and bypass Super Bot Fight Mode and Rate Limiting phases
4. WHEN a request contains the X-Partner-Key header with an incorrect secret key THEN the system SHALL not skip protection and apply normal bot detection rules
5. WHEN a request does not contain the X-Partner-Key header THEN the system SHALL apply normal bot detection and protection rules

### Requirement 5

**User Story:** As a user, I want to see my protected domain's status and access the backdoor key, so that I can integrate the protection into my applications.

#### Acceptance Criteria

1. WHEN a project reaches 'protected' status THEN the system SHALL display a success banner on the setup page
2. WHEN a project is protected THEN the system SHALL display the secret key in an obscured format (e.g., "gk_live_••••")
3. WHEN a user views the secret key THEN the system SHALL provide a copy button to easily copy the full key
4. WHEN a user views the protected project THEN the system SHALL display an integration code snippet showing how to use the backdoor
5. WHEN a user views the integration snippet THEN the system SHALL show the correct domain and secret key in the example curl command

### Requirement 6

**User Story:** As a user, I want to see all my projects on the dashboard, so that I can manage multiple protected domains.

#### Acceptance Criteria

1. WHEN a user navigates to the dashboard THEN the system SHALL display a grid of all projects belonging to that user
2. WHEN projects are displayed THEN the system SHALL show the domain name and current status for each project
3. WHEN a project is in pending_ns status THEN the system SHALL display a yellow status badge with "⚠ Pending Setup" text
4. WHEN a project is in protected status THEN the system SHALL display a green status badge with "✅ Secure & Active" text
5. WHEN a user clicks on a project card THEN the system SHALL navigate to the project's setup view

### Requirement 7

**User Story:** As a system, I want to securely store and manage user projects, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN a project is created THEN the system SHALL store it in the projects table with all required fields
2. WHEN a project is stored THEN the system SHALL link it to the authenticated user via user_id
3. WHEN a project is queried THEN the system SHALL only return projects belonging to the authenticated user
4. WHEN a project status is updated THEN the system SHALL persist the change to the database immediately
5. WHEN a project is accessed THEN the system SHALL validate that the requesting user owns the project

### Requirement 8

**User Story:** As a user, I want an improved verification flow with better status handling, so that I can easily track and manage my domain protection setup.

#### Acceptance Criteria

1. WHEN a project is in pending_ns status THEN the system SHALL show nameservers with a copy icon for easy copying
2. WHEN a project is in pending_ns status THEN the system SHALL display a "Verify Setup" button that triggers verifyProjectStatus
3. WHEN a user clicks "Verify Setup" THEN the system SHALL show a loading spinner during verification
4. WHEN verification succeeds and status becomes protected THEN the system SHALL trigger a confetti animation and refresh the card
5. WHEN a project is in protected status THEN the system SHALL show a "View Integration Code" button linking to the integration page
6. WHEN a project is in protected status THEN the system SHALL hide the "Verify" button as it is no longer needed
7. WHEN Cloudflare API returns 401/403 errors THEN the system SHALL flag the project as "Auth Error" in the UI

### Requirement 9

**User Story:** As a system architect, I want a dedicated cloudflare-verification module, so that verification logic is properly organized and maintainable.

#### Acceptance Criteria

1. WHEN the system needs to verify project status THEN it SHALL use a dedicated verifyProjectStatus function in actions/cloudflare-verification.ts
2. WHEN verifyProjectStatus is called THEN it SHALL fetch project data including zone_id, api_token, and secret_key from the database
3. WHEN the Cloudflare zone status is 'pending' THEN the system SHALL return status 'pending_ns' with message 'Waiting for Nameserver update.'
4. WHEN the Cloudflare zone status is 'active' THEN the system SHALL deploy WAF rules and update project status to 'protected'
5. WHEN WAF rules are deployed THEN the system SHALL return status 'protected' with message 'Domain active & Firewall injected.'

### Requirement 10

**User Story:** As a developer, I want to use the Gatekeeper API to bypass bot protection for my applications, so that I can integrate seamless access without challenges.

#### Acceptance Criteria

1. WHEN a developer includes the X-Partner-Key header in a request THEN the system SHALL validate it against the stored secret key
2. WHEN the X-Partner-Key header matches the secret key THEN the system SHALL skip bot protection phases entirely including Super Bot Fight Mode and Rate Limiting
3. WHEN the X-Partner-Key header is missing or incorrect THEN the system SHALL apply the standard bot detection and protection rules
4. WHEN a request includes the correct partner key THEN the system SHALL bypass all bot detection without any challenges
5. WHEN a request includes an incorrect partner key THEN the system SHALL apply normal Cloudflare bot protection rules
