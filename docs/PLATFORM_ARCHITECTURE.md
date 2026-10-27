# Campus Scouts platform architecture

## Scope and boundary

The current application is a public TanStack Start website. It does not yet have a configured database, identity provider, email provider, object store, or realtime service. Accordingly, no private workspace, admin console, messaging interface, or application persistence is exposed as a working product.

The public site remains independent of private student data. Private routes must not be added until the server-side access layer below is connected and tested.

## Recommended deployment shape

Use the existing Cloudflare-compatible TanStack Start build with:

- PostgreSQL as the authoritative database.
- A TypeScript ORM/migration tool that supports the selected deployment runtime.
- A transactional session table with hashed, rotating session tokens and expiry/revocation metadata.
- An email adapter for invitations and password-reset or magic-link delivery.
- Private object storage for uploads, accessed through short-lived signed URLs only.
- A realtime provider or durable WebSocket-compatible service for messages and notification fan-out.

No browser state, route flag, or client-side role check is an authorization mechanism.

## Authorisation model

Roles are `admin`, `reviewer`, `mentor`, and `scout`. Server functions must resolve the session, load the user and role, and check a capability before every read/write. Conversation reads and writes require explicit membership; admins do not receive blanket access to private direct messages. Moderation access must be an explicit, auditable escalation path.

## Core records

| Area        | Records                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| Identity    | User, RoleAssignment, Session, Invitation, PasswordReset, AccountSuspension        |
| Programme   | ScoutProfile, Campus, Cohort, Membership, Application                              |
| Work        | Task, TaskAssignment, Submission, ReviewAssignment, Rubric, Grade, Revision        |
| Recognition | SignalLedgerEntry, Reward, RewardClaim, Certificate                                |
| Community   | Channel, Conversation, ConversationMember, Message, Reaction, Report, Notification |
| Content     | InsightDraft, ProjectDraft, BriefDraft, PublishReview                              |
| Governance  | AuditEvent, Asset, RetentionPolicy                                                 |

## Critical transaction rules

- Accepting an application creates an invitation and audit event in one transaction.
- A review decision locks the submission, validates the reviewer assignment, records feedback, and writes a Signal ledger entry exactly once using an idempotency key.
- Reward eligibility is derived from the ledger/claim records on the server; it is never trusted from the client.
- Certificate verification uses a public opaque identifier; revocation stays server-authoritative.
- Messages require conversation membership and are persisted before any realtime broadcast.

## Delivery stages

1. Provision the service bindings and implement migrations, identity/session management, and a server-side application flow.
2. Add Scout workspace plus task assignment/submission/review and ledger transactions.
3. Add admin/reviewer console and audit events.
4. Add private uploads, realtime conversations, notification delivery, and moderation workflow.
5. Add end-to-end tests for each role boundary and sensitive workflow before enabling real data.
