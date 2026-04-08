-- ============================================================
-- Appointment Service — Migration: reason_type field
-- ============================================================
-- Purpose: Add a structured appointment reason (CONSULTA / VACUNACION / URGENCIA)
--          while preserving the free-text 'reason' column for detailed notes.
--
-- Run this in the Appointment Service Supabase SQL Editor.
-- ============================================================

-- 1. Add reason_type column with default 'CONSULTA'
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS reason_type VARCHAR(50) DEFAULT 'CONSULTA';

-- 2. Add a constraint to enforce valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'appointments_reason_type_check'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT appointments_reason_type_check
            CHECK (reason_type IN ('CONSULTA', 'VACUNACION', 'URGENCIA'));
    END IF;
END
$$;

-- 3. Backfill existing rows
UPDATE appointments
    SET reason_type = 'CONSULTA'
    WHERE reason_type IS NULL;

-- 4. (Optional) Add index for quick filtering by type
CREATE INDEX IF NOT EXISTS idx_appointments_reason_type ON appointments (reason_type);
