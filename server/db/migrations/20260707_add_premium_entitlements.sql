-- Migration: Add Premium Entitlements (spec 003) — RevenueCat-backed subscription cache
-- Date: 2026-07-07

ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at BIGINT;
