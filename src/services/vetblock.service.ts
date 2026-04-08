import {
  findVetBlocksByClinic,
  findVetBlocksByVet,
  findVetBlockById,
  createVetBlock,
  updateVetBlock,
  deleteVetBlock,
} from '../repositories/vetblock.repository';
import { VetBlockRow, CreateVetBlockBody, UpdateVetBlockBody } from '../models/appointment.model';

export async function getVetBlocksByClinic(clinicId: string): Promise<VetBlockRow[]> {
  return findVetBlocksByClinic(clinicId);
}

export async function getVetBlocksByVet(
  clinicId: string,
  veterinarianId: string,
): Promise<VetBlockRow[]> {
  return findVetBlocksByVet(clinicId, veterinarianId);
}

export async function getVetBlockById(id: string): Promise<VetBlockRow | null> {
  return findVetBlockById(id);
}

export async function createClinicVetBlock(
  clinicId: string,
  body: CreateVetBlockBody,
): Promise<VetBlockRow> {
  return createVetBlock({ ...body, clinic_id: clinicId });
}

export async function updateClinicVetBlock(
  id: string,
  body: UpdateVetBlockBody,
): Promise<VetBlockRow | null> {
  const existing = await findVetBlockById(id);
  if (!existing) return null;
  return updateVetBlock(id, body);
}

export async function deleteClinicVetBlock(id: string): Promise<boolean> {
  const existing = await findVetBlockById(id);
  if (!existing) return false;
  await deleteVetBlock(id);
  return true;
}
