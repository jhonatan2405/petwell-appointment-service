import {
  findWaitlistByClinic,
  findWaitlistById,
  createWaitlistEntry,
  patchWaitlistStatus,
  deleteWaitlistEntry,
} from '../repositories/waitlist.repository';
import { WaitlistRow, CreateWaitlistBody, WaitlistStatus } from '../models/appointment.model';
import { JwtPayload } from '../utils/jwt.util';

export async function getWaitlistByClinic(clinicId: string): Promise<WaitlistRow[]> {
  return findWaitlistByClinic(clinicId);
}

export async function joinWaitlist(
  user: JwtPayload,
  body: CreateWaitlistBody,
): Promise<WaitlistRow> {
  return createWaitlistEntry({ ...body, owner_id: user.sub });
}

export async function updateWaitlistStatus(
  id: string,
  status: WaitlistStatus,
  user: JwtPayload,
): Promise<WaitlistRow> {
  const entry = await findWaitlistById(id);
  if (!entry) {
    const err = new Error('Entrada de lista de espera no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }
  if (entry.clinic_id !== user.clinic_id) {
    const err = new Error('Sin permisos para modificar esta entrada');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  return patchWaitlistStatus(id, status);
}

export async function removeWaitlistEntry(id: string, user: JwtPayload): Promise<void> {
  const entry = await findWaitlistById(id);
  if (!entry) {
    const err = new Error('Entrada de lista de espera no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }

  if (user.role === 'DUENO_MASCOTA') {
    if (entry.owner_id !== user.sub) {
      const err = new Error('Sin permisos para eliminar esta entrada');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  } else if (user.role === 'CLINIC_ADMIN') {
    if (entry.clinic_id !== user.clinic_id) {
      const err = new Error('Sin permisos para eliminar esta entrada');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  }

  await deleteWaitlistEntry(id);
}
