import { Request, Response } from 'express';
import {
  getWaitlistByClinic,
  joinWaitlist,
  updateWaitlistStatus,
  removeWaitlistEntry,
} from '../services/waitlist.service';
import { successResponse, errorResponse } from '../utils/response.util';
import { CreateWaitlistBody, WaitlistStatus, PatchWaitlistStatusBody } from '../models/appointment.model';

// POST /waitlist
export async function createWaitlistEntry(req: Request, res: Response): Promise<void> {
  try {
    const entry = await joinWaitlist(req.user!, req.body as CreateWaitlistBody);
    res.status(201).json(successResponse('Agregado a lista de espera', entry));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// GET /waitlist/:clinicId
export async function getWaitlist(req: Request, res: Response): Promise<void> {
  try {
    // Ensure clinic staff can only see their own clinic
    if (req.user!.clinic_id && req.user!.clinic_id !== req.params['clinicId']) {
      res.status(403).json(errorResponse('Sin permisos para ver esta lista de espera'));
      return;
    }
    const list = await getWaitlistByClinic(req.params['clinicId']!);
    res.status(200).json(successResponse('Lista de espera obtenida', list));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// PATCH /waitlist/:id/status
export async function patchWaitlistStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body as PatchWaitlistStatusBody;
    const entry = await updateWaitlistStatus(req.params['id']!, status as WaitlistStatus, req.user!);
    res.status(200).json(successResponse('Estado actualizado', entry));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}

// DELETE /waitlist/:id
export async function deleteWaitlistEntry(req: Request, res: Response): Promise<void> {
  try {
    await removeWaitlistEntry(req.params['id']!, req.user!);
    res.status(200).json(successResponse('Eliminado de lista de espera', null));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = parseInt(e.code ?? '500', 10);
    res.status(isNaN(code) ? 500 : code).json(errorResponse(e.message));
  }
}
