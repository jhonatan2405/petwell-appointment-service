import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, validateCreateSchedule } from '../middlewares/validate.middleware';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../controllers/schedule.controller';

const router = Router();

// View schedules — all authenticated roles
router.get('/:clinicId', authenticate, getSchedules);

// Manage schedules — CLINIC_ADMIN only
router.post(
  '/',
  authenticate,
  authorize('CLINIC_ADMIN'),
  validate(validateCreateSchedule),
  createSchedule,
);

router.put('/:id', authenticate, authorize('CLINIC_ADMIN'), updateSchedule);
router.delete('/:id', authenticate, authorize('CLINIC_ADMIN'), deleteSchedule);

export default router;
