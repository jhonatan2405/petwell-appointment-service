import { supabase } from '../config/supabase';
import {
  AppointmentRow,
  AppointmentStatus,
  CreateAppointmentBody,
  UpdateAppointmentBody,
} from '../models/appointment.model';

const TABLE = 'appointments';

export interface AppointmentFilters {
  status?: AppointmentStatus;
  date?: string;
  veterinarian_id?: string;
  pet_id?: string;
}

export async function findAppointmentsByOwner(
  ownerId: string,
  filters: AppointmentFilters,
): Promise<AppointmentRow[]> {
  let query = supabase.from(TABLE).select('*').eq('owner_id', ownerId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('appointment_date', filters.date);
  if (filters.veterinarian_id) query = query.eq('veterinarian_id', filters.veterinarian_id);
  if (filters.pet_id) query = query.eq('pet_id', filters.pet_id);
  const { data, error } = await query.order('appointment_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AppointmentRow[]) ?? [];
}

export async function findAppointmentsByClinic(
  clinicId: string,
  filters: AppointmentFilters,
): Promise<AppointmentRow[]> {
  let query = supabase.from(TABLE).select('*').eq('clinic_id', clinicId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('appointment_date', filters.date);
  if (filters.veterinarian_id) query = query.eq('veterinarian_id', filters.veterinarian_id);
  if (filters.pet_id) query = query.eq('pet_id', filters.pet_id);
  const { data, error } = await query.order('appointment_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AppointmentRow[]) ?? [];
}

export async function findAppointmentById(id: string): Promise<AppointmentRow | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return (data as AppointmentRow) ?? null;
}

export async function findTakenSlotsForVet(
  veterinarianId: string,
  date: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_time')
    .eq('veterinarian_id', veterinarianId)
    .eq('appointment_date', date)
    .neq('status', 'CANCELLED');

  if (error) throw new Error(error.message);
  return ((data as Array<{ start_time: string }>) ?? []).map(r => r.start_time);
}

export async function findByVetDateTime(
  vetId: string,
  date: string,
  startTime: string,
): Promise<AppointmentRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('veterinarian_id', vetId)
    .eq('appointment_date', date)
    .eq('start_time', startTime)
    .neq('status', 'CANCELLED')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AppointmentRow) ?? null;
}

export async function checkDoubleBooking(
  veterinarianId: string,
  date: string,
  startTime: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from(TABLE)
    .select('id')
    .eq('veterinarian_id', veterinarianId)
    .eq('appointment_date', date)
    .eq('start_time', startTime)
    .neq('status', 'CANCELLED');

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function createAppointment(
  payload: {
    clinic_id: string;
    veterinarian_id: string;
    pet_id: string;
    owner_id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    type: string;
    reason_type?: string;
    reason?: string;
  },
): Promise<AppointmentRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('SUPABASE ERROR:', error);
    // Avoid silent 500s: throw a specific error structure to handle in the controller
    const err = new Error(error.message) as any;
    err.supabaseError = error;
    throw err;
  }
  return data as AppointmentRow;
}

export async function updateAppointment(
  id: string,
  payload: UpdateAppointmentBody & { end_time?: string },
): Promise<AppointmentRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AppointmentRow;
}

export async function patchAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  cancelledBy?: string,
  cancelledReason?: string,
): Promise<AppointmentRow> {
  const updatePayload: Record<string, unknown> = { status };
  if (cancelledBy) updatePayload['cancelled_by'] = cancelledBy;
  if (cancelledReason) updatePayload['cancelled_reason'] = cancelledReason;

  const { data, error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AppointmentRow;
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
