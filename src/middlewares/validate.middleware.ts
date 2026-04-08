import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response.util';

export type Validator = (body: Record<string, unknown>) => string[];

/**
 * Middleware factory that runs a validator function against req.body.
 * Returns 422 with validation errors if any are found.
 */
export function validate(validatorFn: Validator) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors = validatorFn(req.body as Record<string, unknown>);
    if (errors.length > 0) {
      res.status(422).json(errorResponse('Error de validación', errors));
      return;
    }
    next();
  };
}

// ─── Reusable validators ────────────────────────────────────────────────────

export function validateCreateAppointment(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!body['veterinarian_id']) errors.push('veterinarian_id es requerido');
  if (!body['pet_id']) errors.push('pet_id es requerido');
  if (!body['appointment_date']) errors.push('appointment_date es requerido');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body['appointment_date'])))
    errors.push('appointment_date debe tener formato YYYY-MM-DD');
  if (!body['start_time']) errors.push('start_time es requerido');
  else if (!/^\d{2}:\d{2}$/.test(String(body['start_time'])))
    errors.push('start_time debe tener formato HH:MM');
  if (body['type'] && !['PRESENCIAL', 'TELEMEDICINA'].includes(String(body['type'])))
    errors.push('type debe ser PRESENCIAL o TELEMEDICINA');
  return errors;
}

export function validateCreateSchedule(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (body['day_of_week'] === undefined || body['day_of_week'] === null)
    errors.push('day_of_week es requerido');
  else {
    const d = Number(body['day_of_week']);
    if (!Number.isInteger(d) || d < 0 || d > 6)
      errors.push('day_of_week debe ser un entero entre 0 (Lun) y 6 (Dom)');
  }
  if (!body['start_time']) errors.push('start_time es requerido');
  if (!body['end_time']) errors.push('end_time es requerido');
  return errors;
}

export function validateCreateVetBlock(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!body['veterinarian_id']) errors.push('veterinarian_id es requerido');
  if (body['day_of_week'] === undefined || body['day_of_week'] === null)
    errors.push('day_of_week es requerido');
  else {
    const d = Number(body['day_of_week']);
    if (!Number.isInteger(d) || d < 0 || d > 6)
      errors.push('day_of_week debe ser un entero entre 0 y 6');
  }
  if (!body['start_time']) errors.push('start_time es requerido');
  if (!body['end_time']) errors.push('end_time es requerido');
  if (body['slot_duration'] !== undefined) {
    const sd = Number(body['slot_duration']);
    if (!Number.isInteger(sd) || sd <= 0)
      errors.push('slot_duration debe ser un entero positivo en minutos');
  }
  return errors;
}

export function validatePatchStatus(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const valid = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  if (!body['status']) errors.push('status es requerido');
  else if (!valid.includes(String(body['status'])))
    errors.push(`status debe ser uno de: ${valid.join(', ')}`);
  return errors;
}

export function validateCreateWaitlist(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!body['clinic_id']) errors.push('clinic_id es requerido');
  if (!body['pet_id']) errors.push('pet_id es requerido');
  return errors;
}
