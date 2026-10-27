-- Campus Scouts platform schema (PostgreSQL 15+).
-- Apply in order with the deployment migration runner; this file is intentionally idempotent only at schema level.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE platform_role AS ENUM ('admin', 'reviewer', 'mentor', 'scout');
CREATE TYPE application_status AS ENUM ('submitted', 'in_review', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'in_review', 'revision_requested', 'accepted', 'rejected');
CREATE TYPE message_kind AS ENUM ('channel', 'direct', 'project');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  display_name text NOT NULL, password_hash text, suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE role_assignments (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role platform_role NOT NULL, PRIMARY KEY(user_id, role));
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, role platform_role NOT NULL DEFAULT 'scout', token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE campuses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, city text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cohorts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, starts_on date, ends_on date, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE scouts (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, campus_id uuid REFERENCES campuses(id), cohort_id uuid REFERENCES cohorts(id), course text, year_of_study text, bio text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, email text NOT NULL, institution text NOT NULL, course text NOT NULL, interests text[] NOT NULL DEFAULT '{}', skills text[] NOT NULL DEFAULT '{}', portfolio_url text, statement text NOT NULL, previous_work text, areas text[] NOT NULL DEFAULT '{}', status application_status NOT NULL DEFAULT 'submitted', reviewed_by uuid REFERENCES users(id), review_notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX applications_status_created_idx ON applications(status, created_at DESC);
CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, brief text NOT NULL, due_at timestamptz, rubric jsonb NOT NULL DEFAULT '[]', published_at timestamptz, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_assignments (task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, scout_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(task_id, scout_id));
CREATE TABLE submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id), scout_id uuid NOT NULL REFERENCES users(id), body text NOT NULL DEFAULT '', links jsonb NOT NULL DEFAULT '[]', status submission_status NOT NULL DEFAULT 'draft', submitted_at timestamptz, locked_by uuid REFERENCES users(id), lock_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(task_id, scout_id));
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE, reviewer_id uuid NOT NULL REFERENCES users(id), decision submission_status NOT NULL, feedback text NOT NULL, score integer CHECK(score BETWEEN 0 AND 100), idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE signal_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scout_id uuid NOT NULL REFERENCES users(id), delta integer NOT NULL, reason text NOT NULL, submission_id uuid UNIQUE REFERENCES submissions(id), created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL, published_at timestamptz, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind message_kind NOT NULL, title text, project_id uuid, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversation_members (conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_read_at timestamptz, PRIMARY KEY(conversation_id, user_id));
CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL, parent_id uuid REFERENCES messages(id), created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz);
CREATE INDEX messages_conversation_created_idx ON messages(conversation_id, created_at DESC);
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
