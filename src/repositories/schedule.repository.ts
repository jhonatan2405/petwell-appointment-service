import { supabase } from '../config/supabase';
import { ClinicScheduleRow, CreateScheduleBody, UpdateScheduleBody } from '../models/appointment.model';

const TABLE = 'clinic_schedules';

export async function findSchedulesByClinic(clinicId: string): Promise<ClinicScheduleRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('clinic_id', clinicId)
    .order('day_of_week');

  if (error) throw new Error(error.message);
  return (data as ClinicScheduleRow[]) ?? [];
}

export async function findScheduleById(id: string): Promise<ClinicScheduleRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return (data as ClinicScheduleRow) ?? null;
}

export async function createSchedule(
  payload: CreateScheduleBody & { clinic_id: string },
): Promise<ClinicScheduleRow> {
  const insertPayload: any = {
    clinic_id: payload.clinic_id,
    day_of_week: payload.day_of_week,
    open_time: payload.start_time,
    close_time: payload.end_time,
  };
  if (payload.is_active !== undefined) {
    insertPayload.is_active = payload.is_active;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ClinicScheduleRow;
}

export async function updateSchedule(
  id: string,
  payload: UpdateScheduleBody,
): Promise<ClinicScheduleRow> {
  const updatePayload: any = {};
  if (payload.day_of_week !== undefined) updatePayload.day_of_week = payload.day_of_week;
  if (payload.start_time !== undefined) updatePayload.open_time = payload.start_time;
  if (payload.end_time !== undefined) updatePayload.close_time = payload.end_time;
  if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;

  const { data, error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ClinicScheduleRow;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
