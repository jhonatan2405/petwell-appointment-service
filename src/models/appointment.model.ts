// ─── Domain Models / Types ───────────────────────────────────────────────────

export type AppointmentStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'PROCESSING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type AppointmentType = 'PRESENCIAL' | 'TELEMEDICINA';

export type AppointmentReasonType = 'CONSULTA' | 'VACUNACION' | 'URGENCIA';

export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'RESOLVED' | 'CANCELLED';

// ─── DB Row types (snake_case matching Supabase columns) ───────────────────

export interface ClinicScheduleRow {
  id: string;
  clinic_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VetBlockRow {
  id: string;
  clinic_id: string;
  veterinarian_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow {
  id: string;
  clinic_id: string;
  veterinarian_id: string;
  pet_id: string;
  owner_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  type: AppointmentType;
  reason_type: AppointmentReasonType;  // CONSULTA | VACUNACION | URGENCIA
  reason: string | null;
  notes: string | null;
  cancelled_by: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistRow {
  id: string;
  clinic_id: string;
  pet_id: string;
  owner_id: string;
  veterinarian_id: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  reason: string | null;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string;
}

// ─── Request body types ───────────────────────────────────────────────────

export interface CreateAppointmentBody {
  clinic_id?: string;        // only for CLINIC_ADMIN/RECEPCIONISTA
  owner_id?: string;         // only for CLINIC_ADMIN/RECEPCIONISTA
  veterinarian_id: string;
  pet_id: string;
  appointment_date: string;  // YYYY-MM-DD
  start_time: string;        // HH:MM
  type?: AppointmentType;
  reason_type?: AppointmentReasonType; // CONSULTA | VACUNACION | URGENCIA
  reason?: string;
}

export interface UpdateAppointmentBody {
  veterinarian_id?: string;
  appointment_date?: string;
  start_time?: string;
  type?: AppointmentType;
  reason_type?: AppointmentReasonType;
  reason?: string;
  notes?: string;
}

export interface PatchAppointmentStatusBody {
  status: AppointmentStatus;
  cancelled_reason?: string;
}

export interface CreateScheduleBody {
  clinic_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface UpdateScheduleBody {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

export interface CreateVetBlockBody {
  clinic_id?: string;
  veterinarian_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration?: number;
}

export interface UpdateVetBlockBody {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  slot_duration?: number;
  is_active?: boolean;
}

export interface CreateWaitlistBody {
  clinic_id: string;
  pet_id: string;
  veterinarian_id?: string;
  preferred_date?: string;
  preferred_time?: string;
  reason?: string;
}

export interface PatchWaitlistStatusBody {
  status: WaitlistStatus;
}
