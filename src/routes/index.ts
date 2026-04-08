import { Router } from 'express';
import appointmentRoutes from './appointment.routes';
import scheduleRoutes from './schedule.routes';
import vetblockRoutes from './vetblock.routes';
import waitlistRoutes from './waitlist.routes';

const router = Router();

router.use('/appointments', appointmentRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/vetblocks', vetblockRoutes);
router.use('/waitlist', waitlistRoutes);

export default router;
