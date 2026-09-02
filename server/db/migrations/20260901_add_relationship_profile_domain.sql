-- Migration: spec 008 — "Seu Padrão em Relacionamentos" cross-relationship insight domain.
-- Idempotent: safe to run multiple times.

ALTER TABLE ai_insights DROP CONSTRAINT IF EXISTS ai_insights_domain_check;
ALTER TABLE ai_insights ADD CONSTRAINT ai_insights_domain_check
  CHECK (domain IN ('solo', 'couple', 'profile'));

ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS evidence_relationship_ids TEXT[];
