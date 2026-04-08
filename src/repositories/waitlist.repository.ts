import { supabase } from '../config/supabase';
import { WaitlistRow, CreateWaitlistBody, WaitlistStatus } from '../models/appointment.model';

const TABLE = 'waitlist';

export async function findWaitlistByClinic(clinicId: string): Promise<WaitlistRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data as WaitlistRow[]) ?? [];
}

export async function findWaitlistById(id: string): Promise<WaitlistRow | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return (data as WaitlistRow) ?? null;
}

export async function createWaitlistEntry(
  payload: CreateWaitlistBody & { owner_id: string },
): Promise<WaitlistRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      clinic_id: payload.clinic_id,
      pet_id: payload.pet_id,
      owner_id: payload.owner_id,
      veterinarian_id: payload.veterinarian_id ?? null,
      preferred_date: payload.preferred_date ?? null,
      preferred_time: payload.preferred_time ?? null,
      reason: payload.reason ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WaitlistRow;
}

export async function patchWaitlistStatus(
  id: string,
  status: WaitlistStatus,
): Promise<WaitlistRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WaitlistRow;
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
