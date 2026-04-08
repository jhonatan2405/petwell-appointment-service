-- ============================================================
-- PetWell — Appointment Service
-- Row Level Security (RLS) policies
-- Run this in your Supabase SQL editor AFTER schema.sql
-- ============================================================
--
-- IMPORTANT: This service uses the Supabase SERVICE ROLE key
-- from Node.js, which bypasses RLS by design.
-- These policies protect against:
--   1. Direct public/anon API access to Supabase
--   2. Future anon clients or PostgREST exposure
--   3. The Supabase security advisor warnings
--
-- JWT claims are read from: request.jwt.claims
--   sub       → user UUID
--   role      → DUENO_MASCOTA | CLINIC_ADMIN | RECEPCIONISTA | VETERINARIO
--   clinic_id → UUID of the user's clinic (null for DUENO_MASCOTA)
-- ============================================================

-- ─── Helper function: extract JWT claim safely ────────────────────────────────
CREATE OR REPLACE FUNCTION public.jwt_claim(claim TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> claim,
    ''
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- TABLE 1: clinic_schedules
-- Access: CLINIC_ADMIN (write), all clinic staff (read)
-- ============================================================

ALTER TABLE clinic_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "clinic_schedules_select" ON clinic_schedules;
DROP POLICY IF EXISTS "clinic_schedules_insert" ON clinic_schedules;
DROP POLICY IF EXISTS "clinic_schedules_update" ON clinic_schedules;
DROP POLICY IF EXISTS "clinic_schedules_delete" ON clinic_schedules;

-- SELECT: clinic staff and owners can read schedules for any clinic
-- (needed for availability queries)
CREATE POLICY "clinic_schedules_select"
ON clinic_schedules FOR SELECT
USING (
  public.jwt_claim('role') IN (
    'CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO', 'DUENO_MASCOTA'
  )
);

-- INSERT: only CLINIC_ADMIN of the same clinic
CREATE POLICY "clinic_schedules_insert"
ON clinic_schedules FOR INSERT
WITH CHECK (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- UPDATE: only CLINIC_ADMIN of the same clinic
CREATE POLICY "clinic_schedules_update"
ON clinic_schedules FOR UPDATE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- DELETE: only CLINIC_ADMIN of the same clinic
CREATE POLICY "clinic_schedules_delete"
ON clinic_schedules FOR DELETE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- ============================================================
-- TABLE 2: vet_blocks
-- Access: CLINIC_ADMIN (write), clinic staff (read)
-- ============================================================

ALTER TABLE vet_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vet_blocks_select" ON vet_blocks;
DROP POLICY IF EXISTS "vet_blocks_insert" ON vet_blocks;
DROP POLICY IF EXISTS "vet_blocks_update" ON vet_blocks;
DROP POLICY IF EXISTS "vet_blocks_delete" ON vet_blocks;

-- SELECT: any authenticated clinic staff or owner (needed for availability)
CREATE POLICY "vet_blocks_select"
ON vet_blocks FOR SELECT
USING (
  public.jwt_claim('role') IN (
    'CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO', 'DUENO_MASCOTA'
  )
);

-- INSERT: only CLINIC_ADMIN of the same clinic
CREATE POLICY "vet_blocks_insert"
ON vet_blocks FOR INSERT
WITH CHECK (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- UPDATE: only CLINIC_ADMIN of the same clinic
CREATE POLICY "vet_blocks_update"
ON vet_blocks FOR UPDATE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- DELETE: only CLINIC_ADMIN of the same clinic
CREATE POLICY "vet_blocks_delete"
ON vet_blocks FOR DELETE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- ============================================================
-- TABLE 3: appointments  (SENSITIVE — core business data)
-- Access rules:
--   - CLINIC_ADMIN: full access (any appointment)
--   - RECEPCIONISTA / VETERINARIO: same clinic only
--   - DUENO_MASCOTA: their own appointments (owner_id = sub)
-- ============================================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

-- SELECT: CLINIC_ADMIN (all) | clinic staff (same clinic) | owner (theirs)
CREATE POLICY "appointments_select"
ON appointments FOR SELECT
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  OR (
    public.jwt_claim('role') IN ('RECEPCIONISTA', 'VETERINARIO')
    AND public.jwt_claim('clinic_id')::uuid = clinic_id
  )
  OR (
    public.jwt_claim('role') = 'DUENO_MASCOTA'
    AND public.jwt_claim('sub')::uuid = owner_id
  )
);

-- INSERT: CLINIC_ADMIN (any) | RECEPCIONISTA (same clinic) | DUENO_MASCOTA (self as owner)
CREATE POLICY "appointments_insert"
ON appointments FOR INSERT
WITH CHECK (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  OR (
    public.jwt_claim('role') = 'RECEPCIONISTA'
    AND public.jwt_claim('clinic_id')::uuid = clinic_id
  )
  OR (
    public.jwt_claim('role') = 'DUENO_MASCOTA'
    AND public.jwt_claim('sub')::uuid = owner_id
  )
);

-- UPDATE: CLINIC_ADMIN (all) | RECEPCIONISTA (same clinic) | DUENO_MASCOTA (theirs, validated in service layer)
CREATE POLICY "appointments_update"
ON appointments FOR UPDATE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
  OR (
    public.jwt_claim('role') IN ('RECEPCIONISTA', 'VETERINARIO')
    AND public.jwt_claim('clinic_id')::uuid = clinic_id
  )
  OR (
    public.jwt_claim('role') = 'DUENO_MASCOTA'
    AND public.jwt_claim('sub')::uuid = owner_id
  )
);

-- DELETE: only CLINIC_ADMIN
CREATE POLICY "appointments_delete"
ON appointments FOR DELETE
USING (
  public.jwt_claim('role') = 'CLINIC_ADMIN'
);

-- ============================================================
-- TABLE 4: waitlist  (SENSITIVE — owner contact intent data)
-- Access rules:
--   - CLINIC_ADMIN / RECEPCIONISTA: same clinic
--   - DUENO_MASCOTA: their own entries (owner_id = sub)
-- ============================================================

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_select" ON waitlist;
DROP POLICY IF EXISTS "waitlist_insert" ON waitlist;
DROP POLICY IF EXISTS "waitlist_update" ON waitlist;
DROP POLICY IF EXISTS "waitlist_delete" ON waitlist;

-- SELECT: clinic staff (same clinic) | owner (theirs)
CREATE POLICY "waitlist_select"
ON waitlist FOR SELECT
USING (
  (
    public.jwt_claim('role') IN ('CLINIC_ADMIN', 'RECEPCIONISTA')
    AND public.jwt_claim('clinic_id')::uuid = clinic_id
  )
  OR (
    public.jwt_claim('role') = 'DUENO_MASCOTA'
    AND public.jwt_claim('sub')::uuid = owner_id
  )
);

-- INSERT: DUENO_MASCOTA only (they join the waitlist)
CREATE POLICY "waitlist_insert"
ON waitlist FOR INSERT
WITH CHECK (
  public.jwt_claim('role') = 'DUENO_MASCOTA'
  AND public.jwt_claim('sub')::uuid = owner_id
);

-- UPDATE: clinic staff (same clinic) — status transitions
CREATE POLICY "waitlist_update"
ON waitlist FOR UPDATE
USING (
  public.jwt_claim('role') IN ('CLINIC_ADMIN', 'RECEPCIONISTA')
  AND public.jwt_claim('clinic_id')::uuid = clinic_id
);

-- DELETE: DUENO_MASCOTA (own) or CLINIC_ADMIN (any in their clinic)
CREATE POLICY "waitlist_delete"
ON waitlist FOR DELETE
USING (
  (
    public.jwt_claim('role') = 'DUENO_MASCOTA'
    AND public.jwt_claim('sub')::uuid = owner_id
  )
  OR (
    public.jwt_claim('role') = 'CLINIC_ADMIN'
    AND public.jwt_claim('clinic_id')::uuid = clinic_id
  )
);

-- ============================================================
-- VERIFICATION QUERIES (run after applying policies)
-- ============================================================

-- Check RLS status on all 4 tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('clinic_schedules', 'vet_blocks', 'appointments', 'waitlist');

-- List all policies:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
