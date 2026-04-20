import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { errorResponse } from '../utils/response.util';

/**
 * Middleware de autenticación para comunicación interna entre microservicios.
 *
 * Valida el header `X-Internal-Service-Key` contra la clave compartida
 * configurada en INTERNAL_SERVICE_KEY.
 *
 * NO sustituye a `authenticate` para usuarios normales.
 * Usar EXCLUSIVAMENTE en rutas internas que no deben ser accesibles por el frontend.
 *
 * Header esperado:
 *   X-Internal-Service-Key: <INTERNAL_SERVICE_KEY>
 */
export function authenticateService(req: Request, res: Response, next: NextFunction): void {
  const serviceKey = req.headers['x-internal-service-key'];

  if (!serviceKey) {
    res.status(401).json(errorResponse('Servicio no autenticado: header X-Internal-Service-Key ausente'));
    return;
  }

  if (serviceKey !== env.INTERNAL_SERVICE_KEY) {
    // Usar 403 en lugar de 401 para distinguir "clave presente pero incorrecta"
    res.status(403).json(errorResponse('Servicio no autorizado: clave interna inválida'));
    return;
  }

  next();
}
