import axios from 'axios';
import { env } from '../config/env';
import {
  findAppointmentsByOwner,
  findAppointmentsByClinic,
  findAppointmentById,
  checkDoubleBooking,
  findByVetDateTime,
  createAppointment,
  updateAppointment,
  patchAppointmentStatus,
  deleteAppointment,
  AppointmentFilters,
} from '../repositories/appointment.repository';
import { findVetBlocksByVetAndDay } from '../repositories/vetblock.repository';
import { generateSlots } from '../utils/slots.util';
import {
  AppointmentRow,
  AppointmentStatus,
  CreateAppointmentBody,
  UpdateAppointmentBody,
} from '../models/appointment.model';
import { JwtPayload } from '../utils/jwt.util';

// ─── Event publisher (console.log stub) ────────────────────────────────────

function publishEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }));
}

// ─── External service verification y obtención de datos ────────────────────

async function getPet(petId: string, token: string, cache?: Map<string, any>): Promise<any> {
  if (cache?.has(petId)) return cache.get(petId);
  try {
    const { data } = await axios.get(`${env.PET_SERVICE_URL}/api/v1/pets/${petId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const pet = data?.data;
    if (cache) cache.set(petId, pet);
    return pet;
  } catch (e) {
    return null;
  }
}

async function getUser(userId: string, token: string, cache?: Map<string, any>): Promise<any> {
  if (cache?.has(userId)) return cache.get(userId);
  try {
    const { data } = await axios.get(`${env.USER_SERVICE_URL}/api/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const user = data?.data;
    if (cache) cache.set(userId, user);
    return user;
  } catch (e) {
    return null;
  }
}

async function getClinic(clinicId: string, token: string, cache?: Map<string, any>): Promise<any> {
  if (cache?.has(clinicId)) return cache.get(clinicId);
  try {
    const { data } = await axios.get(`${env.USER_SERVICE_URL}/api/v1/clinics/${clinicId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const clinic = data?.data;
    if (cache) cache.set(clinicId, clinic);
    return clinic;
  } catch (e) {
    return null;
  }
}

async function verifyPetOwnership(
  petId: string,
  ownerId: string,
  token: string,
): Promise<any> {
  try {
    const { data } = await axios.get(`${env.PET_SERVICE_URL}/api/v1/pets/${petId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    console.log("PET DATA:", data);

    const pet = data?.data;
    
    let isOwner = false;

    if (pet) {
      if (pet.owner_id) {
        isOwner = pet.owner_id === ownerId;
      } else if (pet.owner_ids && Array.isArray(pet.owner_ids)) {
        isOwner = pet.owner_ids.includes(ownerId);
      } else if (pet.owners && Array.isArray(pet.owners)) {
        isOwner = pet.owners.some((o: any) => o.id === ownerId);
      }
    }

    if (!isOwner) {
      const err = new Error('No autorizado para esta mascota');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    
    return pet;
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) {
        const err = new Error('Mascota no encontrada');
        (err as NodeJS.ErrnoException).code = '404';
        throw err;
      }
      if (e.response?.status === 403) {
        const err = new Error('No autorizado para esta mascota');
        (err as NodeJS.ErrnoException).code = '403';
        throw err;
      }
    }
    // Propagate locally generated errors
    if (e instanceof Error && (e as NodeJS.ErrnoException).code) throw e;
    
    const err = new Error('Error al verificar mascota');
    (err as NodeJS.ErrnoException).code = '500';
    throw err;
  }
}

async function verifyVetInClinic(
  veterinarianId: string,
  clinicId: string,
  token: string,
): Promise<void> {
  try {
    const response = await axios.get(`${env.USER_SERVICE_URL}/api/v1/users/${veterinarianId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const vet = response.data.data;
    console.log("VET DATA:", vet);
    const vetClinicId: string = vet?.clinic_id ?? '';
    if (vetClinicId !== clinicId) {
      const err = new Error('El veterinario no pertenece a la clínica');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      const err = new Error('Veterinario no encontrado');
      (err as NodeJS.ErrnoException).code = '404';
      throw err;
    }
    if (e instanceof Error && (e as NodeJS.ErrnoException).code) throw e;
    const err = new Error('Error al comunicarse con User Service');
    (err as NodeJS.ErrnoException).code = '502';
    throw err;
  }
}

// ─── Compute end_time from vet blocks ──────────────────────────────────────

async function computeEndTime(
  veterinarianId: string,
  startTime: string,
  date: string,
): Promise<string> {
  const appointmentDate = new Date(date + 'T00:00:00');
  const jsDay = appointmentDate.getUTCDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const blocks = await findVetBlocksByVetAndDay(veterinarianId, dayOfWeek);
  const normalizedStart = startTime.substring(0, 5);

  for (const block of blocks) {
    const slots = generateSlots(block.start_time, block.end_time, block.slot_duration);
    const match = slots.find(s => s.start_time === normalizedStart);
    if (match) return match.end_time;
  }

  // fallback: 30-min default
  const [h, m] = startTime.split(':').map(Number);
  const end = new Date(0, 0, 0, h, (m ?? 0) + 30);
  return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
}

// ─── Service methods ────────────────────────────────────────────────────────

export async function listAppointments(
  user: JwtPayload,
  filters: AppointmentFilters,
  authToken: string,
): Promise<any[]> {
  const userId = user.sub || user.id;
  let appointments: AppointmentRow[] = [];

  if (user.role === 'DUENO_MASCOTA') {
    appointments = await findAppointmentsByOwner(userId as string, filters);
  } else {
    if (!user.clinic_id) {
      const err = new Error('Clínica no especificada en el token');
      (err as NodeJS.ErrnoException).code = '400';
      throw err;
    }
    appointments = await findAppointmentsByClinic(user.clinic_id as string, filters);
  }

  const petCache = new Map<string, any>();
  const userCache = new Map<string, any>();
  const clinicCache = new Map<string, any>();

  return Promise.all(
    appointments.map(async (appointment) => {
      const pet = await getPet(appointment.pet_id, authToken, petCache);
      const vet = await getUser(appointment.veterinarian_id, authToken, userCache);
      const owner = await getUser(pet?.owner_id || appointment.owner_id, authToken, userCache);
      const clinic = await getClinic(appointment.clinic_id, authToken, clinicCache);

      return {
        ...appointment,
        pet_name: pet?.name,
        pet_photo_url: pet?.photo_url ?? null,
        owner_name: owner?.name,
        owner_photo_url: owner?.photo_url ?? null,
        veterinarian_name: vet?.name,
        veterinarian_photo_url: vet?.photo_url ?? null,
        clinic_name: clinic?.name,
        clinic_logo_url: clinic?.logo_url ?? null,
      };
    })
  );
}

export async function getAppointment(
  id: string,
  user: JwtPayload,
  authToken: string,
): Promise<any> {
  console.log("🚨 SERVICE METHOD EJECUTADO");
  console.log("USER BACK:", user);

  // Normalize role to guard against whitespace / encoding issues from the JWT
  const userRole = (user.role ?? '').trim().toUpperCase();

  const appointment = await findAppointmentById(id);
  if (!appointment) {
    const err = new Error('Cita no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }

  // ✅ CLINIC_ADMIN: acceso total — bypass all further checks
  if (userRole === 'CLINIC_ADMIN') {
    const pet    = await getPet(appointment.pet_id, authToken);
    const vet    = await getUser(appointment.veterinarian_id, authToken);
    const owner  = await getUser(pet?.owner_id || appointment.owner_id, authToken);
    const clinic = await getClinic(appointment.clinic_id, authToken);
    return {
      ...appointment,
      pet_name:          pet?.name   ?? null,
      pet_photo_url:     pet?.photo_url ?? null,
      owner_name:        owner?.name ?? null,
      owner_photo_url:   owner?.photo_url ?? null,
      veterinarian_name: vet?.name   ?? null,
      veterinarian_photo_url: vet?.photo_url ?? null,
      clinic_name:       clinic?.name ?? null,
      clinic_logo_url:   clinic?.logo_url ?? null,
    };
  }

  const pet    = await getPet(appointment.pet_id, authToken);
  const vet    = await getUser(appointment.veterinarian_id, authToken);
  const owner  = await getUser(pet?.owner_id || appointment.owner_id, authToken);
  const clinic = await getClinic(appointment.clinic_id, authToken);

  const enrichedAppointment = {
    ...appointment,
    pet_name:          pet?.name   ?? null,
    pet_photo_url:     pet?.photo_url ?? null,
    owner_name:        owner?.name ?? null,
    owner_photo_url:   owner?.photo_url ?? null,
    veterinarian_name: vet?.name   ?? null,
    veterinarian_photo_url: vet?.photo_url ?? null,
    clinic_name:       clinic?.name ?? null,
    clinic_logo_url:   clinic?.logo_url ?? null,
  };

  const userId = user.sub || user.id;

  // Pet owner check: handle owner_id (string), owner_ids (array), owners (array of objects)
  let isOwner = false;
  if (pet) {
    if (pet.owner_id) {
      isOwner = pet.owner_id === userId;
    } else if (Array.isArray(pet.owner_ids)) {
      isOwner = pet.owner_ids.includes(userId);
    } else if (Array.isArray(pet.owners)) {
      isOwner = pet.owners.some((o: any) => o.id === userId);
    }
  }
  // Also check the appointment's owner_id directly
  if (!isOwner && appointment.owner_id) {
    isOwner = appointment.owner_id === userId;
  }

  const isStaff = ['RECEPCIONISTA', 'VETERINARIO'].includes(userRole);

  const sameClinic =
    user.clinic_id &&
    appointment.clinic_id &&
    user.clinic_id.toString().trim() === appointment.clinic_id.toString().trim();

  console.log("AUTH CHECK:", { userRole, userId, isOwner, isStaff, sameClinic });

  if (isStaff && sameClinic) {
    return enrichedAppointment;
  }

  if (isOwner) {
    return enrichedAppointment;
  }

  console.log("ACCESS DENIED", { userRole, isStaff, sameClinic, isOwner });
  const err = new Error('No autorizado');
  (err as NodeJS.ErrnoException).code = '403';
  throw err;
}

export async function bookAppointment(
  user: JwtPayload,
  body: CreateAppointmentBody,
  authToken: string,
): Promise<AppointmentRow> {
  console.log("USER:", user);

  console.log("ROLE EN SERVICE:", user.role);

  const allowedRoles = ['DUENO_MASCOTA', 'CLINIC_ADMIN', 'RECEPCIONISTA'];

  if (!allowedRoles.includes(user.role)) {
    const err = new Error('No tienes permisos');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }

  let ownerId: string;
  let clinicId: string;
  const userId = user.sub || user.id;

  if (user.role === 'DUENO_MASCOTA') {
    ownerId = userId as string;
    if (!body.clinic_id) {
      const err = new Error('clinic_id es requerido');
      (err as NodeJS.ErrnoException).code = '400';
      throw err;
    }
    clinicId = body.clinic_id;
  } else {
    // CLINIC_ADMIN or RECEPCIONISTA
    clinicId = user.clinic_id ?? '';
    if (!body.owner_id) {
      const err = new Error('owner_id es requerido para crear cita a nombre de un dueño');
      (err as NodeJS.ErrnoException).code = '400';
      throw err;
    }
    ownerId = body.owner_id;
  }

  // Verify pet ownership
  const pet = await verifyPetOwnership(body.pet_id, ownerId, authToken);

  // Validación SOLO para personal de clínica
  if (
     user.role === 'CLINIC_ADMIN' ||
     user.role === 'RECEPCIONISTA' ||
     user.role === 'VETERINARIO'
  ) {
     if (pet?.primary_clinic_id && pet.primary_clinic_id !== user.clinic_id) {
        const err = new Error('No autorizado para esta clínica');
        (err as NodeJS.ErrnoException).code = '403';
        throw err;
     }
  }

  // Verify vet belongs to clinic
  await verifyVetInClinic(body.veterinarian_id, clinicId, authToken);

  // Normalize start_time to HH:MM
  const startTime = body.start_time.substring(0, 5);

  // Check double booking
  const existing = await findByVetDateTime(
    body.veterinarian_id,
    body.appointment_date,
    startTime
  );

  if (existing) {
    const err = new Error('Este horario ya está ocupado');
    (err as NodeJS.ErrnoException).code = '409';
    throw err;
  }

  // Compute end time from vet block
  const endTime = await computeEndTime(body.veterinarian_id, startTime, body.appointment_date);

  const appointment = await createAppointment({
    clinic_id: clinicId,
    veterinarian_id: body.veterinarian_id,
    pet_id: body.pet_id,
    owner_id: ownerId,
    appointment_date: body.appointment_date,
    start_time: startTime,
    end_time: endTime,
    type: body.type ?? 'PRESENCIAL',
    reason_type: body.reason_type ?? 'CONSULTA',
    reason: body.reason,
  });

  publishEvent('appointment.created', {
    appointmentId: appointment.id,
    clinicId: appointment.clinic_id,
    ownerId: appointment.owner_id,
    petId: appointment.pet_id,
    date: appointment.appointment_date,
    startTime: appointment.start_time,
    type: appointment.type,
  });

  return appointment;
}

export async function editAppointment(
  id: string,
  user: JwtPayload,
  body: UpdateAppointmentBody,
  authToken: string,
): Promise<AppointmentRow> {
  const appointment = await findAppointmentById(id);
  if (!appointment) {
    const err = new Error('Cita no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }

  const userId = user.sub || user.id;

  // Authorization
  if (user.role === 'DUENO_MASCOTA') {
    if (appointment.owner_id !== userId) {
      const err = new Error('Sin permisos para editar esta cita');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    if (appointment.status !== 'PENDING') {
      const err = new Error('Solo puedes editar citas en estado PENDING');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  } else {
    if (appointment.clinic_id !== user.clinic_id) {
      const err = new Error('Sin permisos para editar esta cita');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  }

  // Cannot edit COMPLETED or CANCELLED
  if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
    const err = new Error('No se puede editar una cita COMPLETED o CANCELLED');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }

  const updates: UpdateAppointmentBody & { end_time?: string } = { ...body };

  // Re-validate slot if date/time changes
  if (body.appointment_date || body.start_time || body.veterinarian_id) {
    const newDate = body.appointment_date ?? appointment.appointment_date;
    const newVetId = body.veterinarian_id ?? appointment.veterinarian_id;
    const newStartRaw = body.start_time ?? appointment.start_time;
    const newStart = newStartRaw.substring(0, 5);

    // Verify vet change
    if (body.veterinarian_id && body.veterinarian_id !== appointment.veterinarian_id) {
      await verifyVetInClinic(body.veterinarian_id, appointment.clinic_id, authToken);
    }

    const conflict = await checkDoubleBooking(newVetId, newDate, newStart, id);
    if (conflict) {
      const err = new Error('El nuevo slot ya está ocupado');
      (err as NodeJS.ErrnoException).code = '409';
      throw err;
    }

    if (body.start_time) updates['start_time'] = newStart;
    updates['end_time'] = await computeEndTime(newVetId, newStart, newDate);
  }

  return updateAppointment(id, updates);
}

export async function changeAppointmentStatus(
  id: string,
  user: JwtPayload,
  status: AppointmentStatus,
  cancelledReason?: string,
): Promise<AppointmentRow> {
  const appointment = await findAppointmentById(id);
  if (!appointment) {
    const err = new Error('Cita no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }

  const userId = user.sub || user.id;

  // Authorization by role
  if (user.role === 'DUENO_MASCOTA') {
    if (appointment.owner_id !== userId) {
      const err = new Error('Sin permisos para cambiar esta cita');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    if (status !== 'CANCELLED') {
      const err = new Error('DUENO_MASCOTA solo puede cancelar citas');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      const err = new Error('Solo puedes cancelar citas en estado PENDING o CONFIRMED');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  } else if (user.role === 'VETERINARIO') {
    if (appointment.clinic_id !== user.clinic_id) {
      const err = new Error('Sin permisos para cambiar esta cita');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    if (!['COMPLETED', 'NO_SHOW'].includes(status)) {
      const err = new Error('VETERINARIO solo puede marcar citas como COMPLETED o NO_SHOW');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  } else {
    // CLINIC_ADMIN or RECEPCIONISTA
    if (appointment.clinic_id !== user.clinic_id) {
      const err = new Error('Sin permisos para cambiar esta cita');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
  }

  const updated = await patchAppointmentStatus(
    id,
    status,
    status === 'CANCELLED' ? (userId as string) : undefined,
    cancelledReason,
  );

  if (status === 'CANCELLED') {
    publishEvent('appointment.cancelled', {
      appointmentId: updated.id,
      clinicId: updated.clinic_id,
      ownerId: updated.owner_id,
      cancelledBy: userId as string,
      reason: cancelledReason ?? null,
    });
  }
  if (status === 'COMPLETED') {
    publishEvent('appointment.completed', {
      appointmentId: updated.id,
      clinicId: updated.clinic_id,
      petId: updated.pet_id,
      vetId: updated.veterinarian_id,
    });
  }

  return updated;
}

export async function removeAppointment(
  id: string,
  user: JwtPayload,
): Promise<void> {
  const appointment = await findAppointmentById(id);
  if (!appointment) {
    const err = new Error('Cita no encontrada');
    (err as NodeJS.ErrnoException).code = '404';
    throw err;
  }
  if (appointment.clinic_id !== user.clinic_id) {
    const err = new Error('Sin permisos para eliminar esta cita');
    (err as NodeJS.ErrnoException).code = '403';
    throw err;
  }
  await deleteAppointment(id);
}
