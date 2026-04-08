import { Request, Response } from 'express';
import {
  getVetBlocksByClinic,
  getVetBlocksByVet,
  getVetBlockById,
  createClinicVetBlock,
  updateClinicVetBlock,
  deleteClinicVetBlock,
} from '../services/vetblock.service';
import { successResponse, errorResponse } from '../utils/response.util';
import { CreateVetBlockBody, UpdateVetBlockBody } from '../models/appointment.model';

// GET /vetblocks/:clinicId
export async function getVetBlocks(req: Request, res: Response): Promise<void> {
  try {
    const blocks = await getVetBlocksByClinic(req.params['clinicId']!);
    res.status(200).json(successResponse('Bloques de veterinario obtenidos', blocks));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// GET /vetblocks/:clinicId/:veterinarianId
export async function getVetBlocksForVet(req: Request, res: Response): Promise<void> {
  try {
    const blocks = await getVetBlocksByVet(req.params['clinicId']!, req.params['veterinarianId']!);
    res.status(200).json(successResponse('Bloques obtenidos', blocks));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// POST /vetblocks
export async function createVetBlock(req: Request, res: Response): Promise<void> {
  try {
    console.log("BODY VETBLOCK:", req.body);
    const clinicId = req.user!.clinic_id!;
    const block = await createClinicVetBlock(clinicId, req.body as CreateVetBlockBody);
    res.status(201).json(successResponse('Bloque de veterinario creado', block));
  } catch (err) {
    console.error("ERROR VETBLOCK:", err);
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// PUT /vetblocks/:id
export async function updateVetBlock(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getVetBlockById(req.params['id']!);
    if (!existing) {
      res.status(404).json(errorResponse('Bloque no encontrado'));
      return;
    }
    if (existing.clinic_id !== req.user!.clinic_id) {
      res.status(403).json(errorResponse('Sin permisos para modificar este bloque'));
      return;
    }
    const block = await updateClinicVetBlock(req.params['id']!, req.body as UpdateVetBlockBody);
    res.status(200).json(successResponse('Bloque actualizado', block));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}

// DELETE /vetblocks/:id
export async function deleteVetBlock(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getVetBlockById(req.params['id']!);
    if (!existing) {
      res.status(404).json(errorResponse('Bloque no encontrado'));
      return;
    }
    if (existing.clinic_id !== req.user!.clinic_id) {
      res.status(403).json(errorResponse('Sin permisos para eliminar este bloque'));
      return;
    }
    await deleteClinicVetBlock(req.params['id']!);
    res.status(200).json(successResponse('Bloque eliminado', null));
  } catch (err) {
    res.status(500).json(errorResponse((err as Error).message));
  }
}
