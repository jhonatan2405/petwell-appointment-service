import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { authenticateService } from '../middlewares/service.middleware';
import { validate, validateCreateAppointment, validatePatchStatus } from '../middlewares/validate.middleware';
import {
  getAvailability,
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  patchStatus,
  patchStatusInternal,
  confirmAppointment,
  deleteAppointmentById,
} from '../controllers/appointment.controller';

const router = Router();

// ─── INTERNAL: service-to-service (X-Internal-Service-Key) ───────────────────
// Debe ir ANTES de las rutas con parámetros para evitar conflictos.
router.patch(
  '/:id/internal/complete',
  authenticateService,
  patchStatusInternal,
);

router.patch(
  '/:id/confirm',
  authenticateService,
  confirmAppointment,
);

// Availability — all authenticated roles
router.get('/availability', authenticate, getAvailability);

// List & Create
router.get(
  '/',
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO', 'DUENO_MASCOTA'),
  getAppointments,
);

router.post(
  '/',
  authenticate,
  authorize('DUENO_MASCOTA', 'CLINIC_ADMIN', 'RECEPCIONISTA'),
  validate(validateCreateAppointment),
  createAppointment,
);

// Single appointment
router.get(
  '/:id',
  (req, res, next) => {
    console.log("🚨 ENTRANDO A GET APPOINTMENT DETAIL");
    next();
  },
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO', 'DUENO_MASCOTA'),
  getAppointmentById,
);

router.put(
  '/:id',
  authenticate,
  authorize('DUENO_MASCOTA', 'CLINIC_ADMIN', 'RECEPCIONISTA'),
  updateAppointment,
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('DUENO_MASCOTA', 'CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO'),
  validate(validatePatchStatus),
  patchStatus,
);

router.delete(
  '/:id',
  authenticate,
  authorize('CLINIC_ADMIN'),
  deleteAppointmentById,
);

export default router;

