import request from 'supertest';
import express from 'express';
import { env } from '../../src/config/env';

// Mock config variables
jest.mock('../../src/config/env', () => ({
  env: {
    PORT: 0,
    ALLOWED_ORIGINS: '*',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    INTERNAL_SERVICE_KEY: 'test-service-key',
  }
}));

// We must spy on listen before importing the app to prevent server from hanging in tests
jest.spyOn(express.application, 'listen').mockImplementation(jest.fn());

import app from '../../src/server';
import * as appointmentRepo from '../../src/repositories/appointment.repository';
import * as vetblockRepo from '../../src/repositories/vetblock.repository';
import axios from 'axios';
import jwt from 'jsonwebtoken';

jest.mock('../../src/repositories/appointment.repository');
jest.mock('../../src/repositories/vetblock.repository');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Appointment Service Integration Tests', () => {
  let validToken: string;
  let adminToken: string;

  beforeAll(() => {
    validToken = jwt.sign(
      { id: 'user1', sub: 'user1', role: 'DUENO_MASCOTA' },
      env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { id: 'admin1', sub: 'admin1', role: 'CLINIC_ADMIN', clinic_id: 'clinic1' },
      env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/appointments and /availability (integration - 1)', async () => {
    (appointmentRepo.findAppointmentsByOwner as jest.Mock).mockResolvedValue([{ id: 'appt1', pet_id: 'pet1', veterinarian_id: 'vet1', clinic_id: 'clinic1', owner_id: 'user1' }]);
    mockedAxios.get.mockResolvedValue({ data: { data: { name: 'IntegrationPet' } } });

    // Unauthorized
    let res = await request(app).get('/api/v1/appointments');
    expect(res.status).toBe(401);

    // Success List
    res = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Missing query params for availability
    res = await request(app).get('/api/v1/appointments/availability').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(400); // clinic_id y date son requeridos
  });

  it('GET /api/v1/appointments/:id (integration - 2)', async () => {
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValueOnce(null);

    let res = await request(app).get('/api/v1/appointments/invalid-id').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(404);

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt1', pet_id: 'pet1', clinic_id: 'clinic1', owner_id: 'user1' });
    mockedAxios.get.mockResolvedValue({ data: { data: { owner_id: 'user1' } } });

    res = await request(app).get('/api/v1/appointments/appt1').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('appt1');
  });

  it('POST /api/v1/appointments (integration - 3)', async () => {
    // Missing fields 422
    let res = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${validToken}`).send({ clinic_id: 'clinic1' });
    expect(res.status).toBe(422);

    // Successfully book
    const body = {
      clinic_id: 'clinic1',
      pet_id: 'pet1',
      veterinarian_id: 'vet1',
      appointment_date: '2025-01-01',
      start_time: '10:00'
    };
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'user1' } } };
      if (url.includes('users/')) return { data: { data: { clinic_id: 'clinic1' } } };
      return { data: { data: {} } };
    });
    mockedAxios.post.mockResolvedValue({});
    (appointmentRepo.findByVetDateTime as jest.Mock).mockResolvedValue(null);
    (vetblockRepo.findVetBlocksByVetAndDay as jest.Mock).mockResolvedValue([{ start_time: '08:00', end_time: '12:00', slot_duration: 30 }]);
    (appointmentRepo.createAppointment as jest.Mock).mockResolvedValue({ id: 'new_appt', ...body, type: 'PRESENCIAL', owner_id: 'user1' });

    res = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${validToken}`).send(body);
    expect(res.status).toBe(201);
  });

  it('PUT /api/v1/appointments/:id (integration - 4)', async () => {
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt1', clinic_id: 'clinic1', owner_id: 'user1', status: 'PENDING' });
    (appointmentRepo.updateAppointment as jest.Mock).mockResolvedValue({ id: 'appt1', reason: 'Updated' });

    const res = await request(app)
      .put('/api/v1/appointments/appt1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.reason).toEqual('Updated');
  });

  it('PATCH /api/v1/appointments/:id/status (integration - 5)', async () => {
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({
      id: 'appt1', owner_id: 'user1', clinic_id: 'clinic1', status: 'PENDING'
    });
    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({
      id: 'appt1',
      status: 'CONFIRMED'
    });

    const res = await request(app)
      .patch('/api/v1/appointments/appt1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toEqual('CONFIRMED');
    expect(appointmentRepo.patchAppointmentStatus).toHaveBeenCalled();
  });

  it('DELETE /api/v1/appointments/:id (integration - 6)', async () => {
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({
      id: 'appt1', owner_id: 'user1', clinic_id: 'clinic1', status: 'PENDING'
    });
    (appointmentRepo.deleteAppointment as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/appointments/appt1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Cita eliminada');
  });

  it('PATCH /api/v1/appointments/:id/internal/complete and confirm (integration - 7)', async () => {
    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({ id: 'appt1', status: 'COMPLETED' });

    let res = await request(app)
      .patch('/api/v1/appointments/appt1/internal/complete')
      .set('X-Internal-Service-Key', 'test-service-key');
    expect(res.status).toBe(200);

    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
    res = await request(app)
      .patch('/api/v1/appointments/appt1/confirm')
      .set('X-Internal-Service-Key', 'test-service-key');
    expect(res.status).toBe(200);
  });

  it('Error handling (integration - 8)', async () => {
    (appointmentRepo.findAppointmentsByOwner as jest.Mock).mockRejectedValueOnce(new Error('Test Error'));
    let res = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(500);

    (appointmentRepo.findAppointmentById as jest.Mock).mockRejectedValueOnce(new Error('Test Error'));
    res = await request(app).get('/api/v1/appointments/appt1').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(500);

    const body = { clinic_id: 'c1', pet_id: 'p1', veterinarian_id: 'v1', appointment_date: '2025-01-01', start_time: '10:00' };
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'user1' } } };
      if (url.includes('users/')) return { data: { data: { clinic_id: 'c1' } } };
      return { data: { data: {} } };
    });
    (appointmentRepo.findByVetDateTime as jest.Mock).mockRejectedValueOnce({ supabaseError: { message: 'SupaErr' } });
    res = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${validToken}`).send(body);
    expect(res.status).toBe(400);

    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockRejectedValueOnce(new Error('Test Error'));
    res = await request(app).patch('/api/v1/appointments/appt1/status').set('Authorization', `Bearer ${adminToken}`).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(500);

    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockRejectedValueOnce(new Error('Test Error'));
    res = await request(app).patch('/api/v1/appointments/appt1/internal/complete').set('X-Internal-Service-Key', 'test-service-key');
    expect(res.status).toBe(500);

    (appointmentRepo.deleteAppointment as jest.Mock).mockRejectedValueOnce(new Error('Test Error'));
    res = await request(app).delete('/api/v1/appointments/appt1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});
