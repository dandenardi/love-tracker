-- Migration: Add missing columns for partnership tracking and event synchronization
-- Date: 2026-05-14

-- 1. Add unpaired_at to partnerships table
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS unpaired_at BIGINT;

-- 2. Add partnership_id to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL;
