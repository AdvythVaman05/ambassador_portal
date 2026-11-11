-- Preserve existing application rows while recording mandatory applicant acknowledgements going forward.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS consent_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpaid_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unpaid_acknowledged_at timestamptz;
