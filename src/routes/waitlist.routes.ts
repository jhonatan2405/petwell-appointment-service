import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, validateCreateWaitlist } from '../middlewares/validate.middleware';
import {
  createWaitlistEntry,
  getWaitlist,
  patchWaitlistStatus,
  deleteWaitlistEntry,
} from '../controllers/waitlist.controller';

const router = Router();

// Join waitlist — DUENO_MASCOTA only
router.post(
  '/',
  authenticate,
  authorize('DUENO_MASCOTA'),
  validate(validateCreateWaitlist),
  createWaitlistEntry,
);

// View waitlist — clinic staff
router.get(
  '/:clinicId',
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA'),
  getWaitlist,
);

// Update status — clinic staff
router.patch(
  '/:id/status',
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA'),
  patchWaitlistStatus,
);

// Delete — DUENO_MASCOTA (own) or CLINIC_ADMIN
router.delete(
  '/:id',
  authenticate,
  authorize('DUENO_MASCOTA', 'CLINIC_ADMIN'),
  deleteWaitlistEntry,
);

export default router;
