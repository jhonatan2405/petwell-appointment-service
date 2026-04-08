import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, validateCreateVetBlock } from '../middlewares/validate.middleware';
import {
  getVetBlocks,
  getVetBlocksForVet,
  createVetBlock,
  updateVetBlock,
  deleteVetBlock,
} from '../controllers/vetblock.controller';

const router = Router();

// View — clinic staff
router.get(
  '/:clinicId',
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO'),
  getVetBlocks,
);

router.get(
  '/:clinicId/:veterinarianId',
  authenticate,
  authorize('CLINIC_ADMIN', 'RECEPCIONISTA', 'VETERINARIO'),
  getVetBlocksForVet,
);

// Manage — CLINIC_ADMIN only
router.post(
  '/',
  authenticate,
  authorize('CLINIC_ADMIN'),
  validate(validateCreateVetBlock),
  createVetBlock,
);

router.put('/:id', authenticate, authorize('CLINIC_ADMIN'), updateVetBlock);
router.delete('/:id', authenticate, authorize('CLINIC_ADMIN'), deleteVetBlock);

export default router;
