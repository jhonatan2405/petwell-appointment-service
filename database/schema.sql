-- ============================================================
-- PetWell — Appointment Service Database Schema
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FUNCTION: auto-update updated_at timestamp
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: clinic_schedules
-- Horarios de atención de cada clínica por día de semana
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     TIME NOT NULL,
  close_time    TIME NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_clinic_day UNIQUE (clinic_id, day_of_week)
);

CREATE TRIGGER trigger_clinic_schedules_updated_at
  BEFORE UPDATE ON clinic_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE 2: vet_blocks
-- Bloques de trabajo asignados a un veterinario en una clínica
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vet_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL,
  veterinarian_id UUID NOT NULL,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_duration   SMALLINT NOT NULL DEFAULT 30,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trigger_vet_blocks_updated_at
  BEFORE UPDATE ON vet_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE 3: appointments
-- Citas agendadas
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL,
  veterinarian_id   UUID NOT NULL,
  pet_id            UUID NOT NULL,
  owner_id          UUID NOT NULL,
  appointment_date  DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
  type              VARCHAR(20) NOT NULL DEFAULT 'PRESENCIAL'
                      CHECK (type IN ('PRESENCIAL','TELEMEDICINA')),
  reason            TEXT,
  notes             TEXT,
  cancelled_by      UUID,
  cancelled_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_vet_date_slot UNIQUE (veterinarian_id, appointment_date, start_time)
);

-- Indexes for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date_status
  ON appointments (clinic_id, appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_vet_date
  ON appointments (veterinarian_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_owner
  ON appointments (owner_id);

CREATE INDEX IF NOT EXISTS idx_appointments_pet
  ON appointments (pet_id);

CREATE TRIGGER trigger_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE 4: waitlist
-- Lista de espera cuando no hay disponibilidad
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL,
  pet_id            UUID NOT NULL,
  owner_id          UUID NOT NULL,
  veterinarian_id   UUID,
  preferred_date    DATE,
  preferred_time    TIME,
  reason            TEXT,
  status            VARCHAR(20) DEFAULT 'WAITING'
                      CHECK (status IN ('WAITING','NOTIFIED','RESOLVED','CANCELLED')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes for waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_clinic_status
  ON waitlist (clinic_id, status);

CREATE TRIGGER trigger_waitlist_updated_at
  BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
