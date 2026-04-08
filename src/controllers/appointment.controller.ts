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
  try {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.split(' ')[1] ?? '';
    const appointment = await bookAppointment(req.user!, req.body as CreateAppointmentBody, token);
    res.status(201).json(successResponse('Cita creada exitosamente', appointment));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
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
