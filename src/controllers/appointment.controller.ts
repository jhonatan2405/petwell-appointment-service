import { Request, Response } from 'express';
import { getAvailableSlots } from '../services/availability.service';
import {
  listAppointments,
  getAppointment,
  bookAppointment,
  editAppointment,
  changeAppointmentStatus,
  removeAppointment,
} from '../services/appointment.service';
import { patchAppointmentStatus } from '../repositories/appointment.repository';
import { successResponse, errorResponse } from '../utils/response.util';
import { AppointmentFilters } from '../repositories/appointment.repository';
import { AppointmentStatus, CreateAppointmentBody, UpdateAppointmentBody } from '../models/appointment.model';

// ─── GET /appointments/availability ─────────────────────────────────────────
export async function getAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { clinic_id, date, veterinarian_id } = req.query as Record<string, string>;
    if (!clinic_id || !date) {
      res.status(400).json(errorResponse('clinic_id y date son requeridos'));
      return;
    }
    const authToken = (req.headers.authorization ?? '').split(' ')[1];
    const result = await getAvailableSlots({ clinic_id, date, veterinarian_id, authToken });
    res.status(200).json(successResponse('Disponibilidad obtenida', result));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── GET /appointments ───────────────────────────────────────────────────────
export async function getAppointments(req: Request, res: Response): Promise<void> {
  try {
    const filters: AppointmentFilters = {
      status: req.query['status'] as AppointmentStatus | undefined,
      date: req.query['date'] as string | undefined,
      veterinarian_id: req.query['veterinarian_id'] as string | undefined,
      pet_id: req.query['pet_id'] as string | undefined,
    };
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.split(' ')[1] ?? '';
    const appointments = await listAppointments(req.user!, filters, token);
    res.status(200).json(successResponse('Citas obtenidas', appointments));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── GET /appointments/:id ───────────────────────────────────────────────────
export async function getAppointmentById(req: Request, res: Response): Promise<void> {
  console.log("🚨 ENTRANDO A GET APPOINTMENT DETAIL");
  try {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.split(' ')[1] ?? '';
    const appointment = await getAppointment(req.params['id']!, req.user!, token);
    res.status(200).json(successResponse('Cita obtenida', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── POST /appointments ──────────────────────────────────────────────────────
export async function createAppointment(req: Request, res: Response): Promise<void> {
  console.log('BODY:', req.body);

  try {
    // 4. Validar campos requeridos antes de insertar
    // 5. Asegurar que los nombres coincidan EXACTAMENTE con la BD
    // DB requires: pet_id, clinic_id, veterinarian_id, appointment_date (date), start_time (time)
    
    // Map in case frontend sends 'date' or 'time' instead of 'appointment_date' or 'start_time'
    const body = {
      ...req.body,
      appointment_date: req.body.appointment_date || req.body.date,
      start_time: req.body.start_time || req.body.time,
    } as CreateAppointmentBody;

    const { pet_id, veterinarian_id, appointment_date, start_time } = body;
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.split(' ')[1] ?? '';
    const role = req.user?.role;
    
    let clinic_id = body.clinic_id;
    if (role === 'DUENO_MASCOTA') {
      if (!clinic_id) {
        res.status(400).json(errorResponse('clinic_id es requerido para DUENO_MASCOTA'));
        return;
      }
    } else {
      clinic_id = req.user?.clinic_id ?? '';
    }

    if (!pet_id || !clinic_id || !veterinarian_id || !appointment_date || !start_time) {
      res.status(400).json(errorResponse('Campos requeridos faltantes. Se requiere: pet_id, clinic_id, veterinarian_id, appointment_date (o date), start_time (o time)'));
      return;
    }

    const appointment = await bookAppointment(req.user!, body, token);
    res.status(201).json(successResponse('Cita creada exitosamente', appointment));
  } catch (err: any) {
    // 2. Capturar errores de Supabase sin usar throw sin manejar (avoiding generic 500)
    if (err.supabaseError) {
      console.error('SUPABASE ERROR:', err.supabaseError);
      res.status(400).json({
        error: err.supabaseError.message || err.message,
        details: err.supabaseError
      });
      return;
    }

    const code = parseInt(err.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(err.message));
  }
}

// ─── PUT /appointments/:id ───────────────────────────────────────────────────
export async function updateAppointment(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.split(' ')[1] ?? '';
    const appointment = await editAppointment(req.params['id']!, req.user!, req.body as UpdateAppointmentBody, token);
    res.status(200).json(successResponse('Cita actualizada', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── PATCH /appointments/:id/status ─────────────────────────────────────────
export async function patchStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status, cancelled_reason } = req.body as { status: AppointmentStatus; cancelled_reason?: string };
    const appointment = await changeAppointmentStatus(req.params['id']!, req.user!, status, cancelled_reason);
    res.status(200).json(successResponse('Estado actualizado', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── PATCH /appointments/:id/internal/complete ───────────────────────────────
/**
 * Ruta exclusiva para comunicación interna entre microservicios.
 * Autenticada por X-Internal-Service-Key, NO por JWT de usuario.
 * Solo marca una cita como COMPLETED — no acepta otros estados.
 * Usada por telemed-service al finalizar una consulta.
 */
export async function patchStatusInternal(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json(errorResponse('appointment id requerido'));
      return;
    }

    const appointment = await patchAppointmentStatus(id, 'COMPLETED');
    console.log(`[Internal] Appointment ${id} marcada COMPLETED por servicio interno`);
    res.status(200).json(successResponse('Estado actualizado internamente', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── PATCH /appointments/:id/confirm ─────────────────────────────────────────
/**
 * Ruta exclusiva para comunicación interna entre microservicios (billing-service).
 * Autenticada por X-Internal-Service-Key.
 * Marca la cita como CONFIRMED tras un pago exitoso.
 */
export async function confirmAppointment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json(errorResponse('appointment id requerido'));
      return;
    }

    const appointment = await patchAppointmentStatus(id, 'CONFIRMED');
    console.log(`[Internal] Appointment ${id} confirmada por pago exitoso (billing-service)`);
    res.status(200).json(successResponse('Cita confirmada correctamente', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// ─── DELETE /appointments/:id ────────────────────────────────────────────────
export async function deleteAppointmentById(req: Request, res: Response): Promise<void> {
  try {
    await removeAppointment(req.params['id']!, req.user!);
    res.status(200).json(successResponse('Cita eliminada', null));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}
