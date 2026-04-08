import { Request, Response } from 'express';
import {
  getSchedulesByClinic,
  getScheduleById,
  createClinicSchedule,
  updateClinicSchedule,
  deleteClinicSchedule,
} from '../services/schedule.service';
import { successResponse, errorResponse } from '../utils/response.util';
import { CreateScheduleBody, UpdateScheduleBody } from '../models/appointment.model';

// GET /schedules/:clinicId
export async function getSchedules(req: Request, res: Response): Promise<void> {
  try {
    const schedules = await getSchedulesByClinic(req.params['clinicId']!);
    res.status(200).json(successResponse('Horarios obtenidos', schedules));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// POST /schedules
export async function createSchedule(req: Request, res: Response): Promise<void> {
  try {
    console.log("BODY RECIBIDO:", req.body);
    const clinicId = req.user!.clinic_id!;
    const schedule = await createClinicSchedule(clinicId, req.body as CreateScheduleBody);
    res.status(201).json(successResponse('Horario creado', schedule));
  } catch (err) {
    console.error("ERROR DETALLADO:", err);
    const e = err as Error & { code?: string };
    // Supabase unique violation
    if (e.message.includes('uq_clinic_day') || e.message.includes('duplicate')) {
      res.status(409).json(errorResponse('Ya existe un horario para ese día en la clínica'));
      return;
    }
    res.status(500).json(errorResponse(e.message));
  }
}

// PUT /schedules/:id
export async function updateSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await updateClinicSchedule(req.params['id']!, req.body as UpdateScheduleBody);
    if (!schedule) {
      res.status(404).json(errorResponse('Horario no encontrado'));
      return;
    }
    // Ownership check
    if (schedule.clinic_id !== req.user!.clinic_id) {
      res.status(403).json(errorResponse('Sin permisos para modificar este horario'));
      return;
    }
    res.status(200).json(successResponse('Horario actualizado', schedule));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// DELETE /schedules/:id
export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getScheduleById(req.params['id']!);
    if (!existing) {
      res.status(404).json(errorResponse('Horario no encontrado'));
      return;
    }
    if (existing.clinic_id !== req.user!.clinic_id) {
      res.status(403).json(errorResponse('Sin permisos para eliminar este horario'));
      return;
    }
    await deleteClinicSchedule(req.params['id']!);
    res.status(200).json(successResponse('Horario eliminado', null));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}
