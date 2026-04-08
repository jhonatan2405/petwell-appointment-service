import { supabase } from '../config/supabase';
import { VetBlockRow, CreateVetBlockBody, UpdateVetBlockBody } from '../models/appointment.model';

const TABLE = 'vet_blocks';

export async function findVetBlocksByClinic(clinicId: string): Promise<VetBlockRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .order('day_of_week');

  if (error) throw new Error(error.message);
  return (data as VetBlockRow[]) ?? [];
}

export async function findVetBlocksByVet(
  clinicId: string,
  veterinarianId: string,
): Promise<VetBlockRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('veterinarian_id', veterinarianId)
    .eq('is_active', true)
    .order('day_of_week');

  if (error) throw new Error(error.message);
  return (data as VetBlockRow[]) ?? [];
}

export async function findVetBlocksByVetAndDay(
  veterinarianId: string,
  dayOfWeek: number,
): Promise<VetBlockRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('veterinarian_id', veterinarianId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return (data as VetBlockRow[]) ?? [];
}

export async function findVetBlocksByClinicAndDay(
  clinicId: string,
  dayOfWeek: number,
): Promise<VetBlockRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return (data as VetBlockRow[]) ?? [];
}

export async function findVetBlockById(id: string): Promise<VetBlockRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return (data as VetBlockRow) ?? null;
}

export async function createVetBlock(
  payload: CreateVetBlockBody & { clinic_id: string },
): Promise<VetBlockRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      clinic_id: payload.clinic_id,
      veterinarian_id: payload.veterinarian_id,
      day_of_week: payload.day_of_week,
      start_time: payload.start_time,
      end_time: payload.end_time,
      slot_duration: payload.slot_duration ?? 30,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as VetBlockRow;
}

export async function updateVetBlock(
  id: string,
  payload: UpdateVetBlockBody,
): Promise<VetBlockRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as VetBlockRow;
}

export async function deleteVetBlock(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
