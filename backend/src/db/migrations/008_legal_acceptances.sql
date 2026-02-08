-- Legal consent clickwrap: immutable record of user acceptance of BAA, ToS, and Privacy Policy
-- HIPAA requirement: retain acceptance records indefinitely

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  document_type VARCHAR(50) NOT NULL,
  document_version VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_document_type CHECK (
    document_type IN ('baa', 'terms_of_service', 'privacy_policy')
  )
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
  ON legal_acceptances(user_id, document_type);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_version
  ON legal_acceptances(document_type, document_version);
