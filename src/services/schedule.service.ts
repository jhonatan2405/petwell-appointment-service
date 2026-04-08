import { findSchedulesByClinic, findScheduleById, createSchedule, updateSchedule, deleteSchedule } from '../repositories/schedule.repository';
import { ClinicScheduleRow, CreateScheduleBody, UpdateScheduleBody } from '../models/appointment.model';

export async function getSchedulesByClinic(clinicId: string): Promise<ClinicScheduleRow[]> {
  return findSchedulesByClinic(clinicId);
}

export async function getScheduleById(id: string): Promise<ClinicScheduleRow | null> {
  return findScheduleById(id);
}

export async function createClinicSchedule(
  clinicId: string,
  body: CreateScheduleBody,
): Promise<ClinicScheduleRow> {
  return createSchedule({ ...body, clinic_id: clinicId });
}

export async function updateClinicSchedule(
  id: string,
  body: UpdateScheduleBody,
): Promise<ClinicScheduleRow | null> {
  const existing = await findScheduleById(id);
  if (!existing) return null;
  return updateSchedule(id, body);
}

export async function deleteClinicSchedule(id: string): Promise<boolean> {
  const existing = await findScheduleById(id);
  if (!existing) return false;
  await deleteSchedule(id);
  return true;
}
