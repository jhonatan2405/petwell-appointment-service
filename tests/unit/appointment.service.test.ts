import {
  listAppointments,
  getAppointment,
  bookAppointment,
  editAppointment,
  changeAppointmentStatus,
  removeAppointment
} from '../../src/services/appointment.service';
import * as appointmentRepo from '../../src/repositories/appointment.repository';
import * as vetblockRepo from '../../src/repositories/vetblock.repository';
import axios from 'axios';

jest.mock('../../src/repositories/appointment.repository');
jest.mock('../../src/repositories/vetblock.repository');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Appointment Service Unit Tests', () => {
  const mockToken = 'mock-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listAppointments coverage (unit - 1)', async () => {
    const user1 = { id: 'u1', sub: 'u1', role: 'DUENO_MASCOTA' } as any;
    const user2 = { id: 'a1', sub: 'a1', role: 'CLINIC_ADMIN', clinic_id: 'c1' } as any;
    
    (appointmentRepo.findAppointmentsByOwner as jest.Mock).mockResolvedValue([{ id: 'appt1', pet_id: 'p1', veterinarian_id: 'v1', clinic_id: 'c1', owner_id: 'u1' }]);
    (appointmentRepo.findAppointmentsByClinic as jest.Mock).mockResolvedValue([{ id: 'appt2', pet_id: 'p2', veterinarian_id: 'v2', clinic_id: 'c1', owner_id: 'u2' }]);
    
    // Simulate axios get returning nulls/errors for caching and error lines
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    const res1 = await listAppointments(user1, {}, mockToken);
    expect(res1.length).toBe(1);
    
    const res2 = await listAppointments(user2, {}, mockToken);
    expect(res2.length).toBe(1);
  });

  it('getAppointment coverage (unit - 2)', async () => {
    const userAdmin = { id: 'a1', sub: 'a1', role: 'CLINIC_ADMIN' } as any;
    const mockAppt = { id: 'appt1', pet_id: 'p1', veterinarian_id: 'v1', clinic_id: 'c1', owner_id: 'u1' };
    
    // Admin access (bypass)
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue(mockAppt);
    mockedAxios.get.mockResolvedValue({ data: { data: { name: 'mock' } } });
    const resAdmin = await getAppointment('appt1', userAdmin, mockToken);
    expect(resAdmin).toBeDefined();

    // Owner ids array check
    const userOwner = { id: 'u2', sub: 'u2', role: 'DUENO_MASCOTA' } as any;
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { owner_ids: ['u2'] } } });
    const resOwnerIds = await getAppointment('appt1', userOwner, mockToken);
    expect(resOwnerIds.id).toEqual('appt1');

    // Owners array check
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { owners: [{ id: 'u2' }] } } });
    const resOwners = await getAppointment('appt1', userOwner, mockToken);
    expect(resOwners.id).toEqual('appt1');
  });

  it('bookAppointment coverage - success paths (unit - 3)', async () => {
    const userOwner = { id: 'u1', sub: 'u1', role: 'DUENO_MASCOTA' } as any;
    const bodyTelemed = { clinic_id: 'c1', pet_id: 'p1', veterinarian_id: 'v1', appointment_date: '2025-01-01', start_time: '10:00:00', type: 'TELEMEDICINA', reason_type: 'CONSULTA' } as any;
    
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'u1' } } };
      if (url.includes('users/v1')) return { data: { data: { clinic_id: 'c1' } } };
      if (url.includes('billing/pricing')) return { data: { data: { price_telemedicina: 50000 } } };
      return { data: { data: {} } };
    });
    mockedAxios.post.mockResolvedValue({});

    (appointmentRepo.findByVetDateTime as jest.Mock).mockResolvedValue(null);
    (vetblockRepo.findVetBlocksByVetAndDay as jest.Mock).mockResolvedValue([{ start_time: '08:00', end_time: '12:00', slot_duration: 30 }]);
    (appointmentRepo.createAppointment as jest.Mock).mockResolvedValue({ id: 'appt_telemed', clinic_id: 'c1', type: 'TELEMEDICINA', owner_id: 'u1', appointment_date: '2025-01-01', start_time: '10:00' });

    const resBookTelemed = await bookAppointment(userOwner, bodyTelemed, mockToken);
    expect(resBookTelemed.id).toEqual('appt_telemed');

    // Wait for async background tasks
    await new Promise(r => setTimeout(r, 150));
  });

  it('bookAppointment coverage - error paths (unit - 4)', async () => {
    const userOwner = { id: 'u1', sub: 'u1', role: 'DUENO_MASCOTA' } as any;
    const body = { clinic_id: 'c1', pet_id: 'p1', veterinarian_id: 'v1', appointment_date: '2025-01-01', start_time: '10:00:00', type: 'PRESENCIAL', reason_type: 'CONSULTA' } as any;

    // verifyPetOwnership 404
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('Mascota no encontrada');

    // verifyPetOwnership 403
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('No autorizado para esta mascota');

    // verifyPetOwnership unknown error
    mockedAxios.isAxiosError.mockReturnValue(false);
    mockedAxios.get.mockRejectedValueOnce(new Error('Unknown'));
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('Error al verificar mascota');

    // Not owner check
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { owner_id: 'other' } } });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('No autorizado para esta mascota');

    // verifyVetInClinic 404
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'u1' } } };
      throw { response: { status: 404 } };
    });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('Veterinario no encontrado');

    // verifyVetInClinic 403
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'u1' } } };
      return { data: { data: { clinic_id: 'c2' } } }; // Wrong clinic
    });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('El veterinario no pertenece a la clínica');

    // verifyVetInClinic 502
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'u1' } } };
      throw new Error('Some DB error');
    });
    await expect(bookAppointment(userOwner, body, mockToken)).rejects.toThrow('Error al comunicarse con User Service');

    // computeEndTime fallback coverage AND billing/users catch blocks
    mockedAxios.get.mockImplementation(async (url) => {
      if (url.includes('pets/')) return { data: { data: { owner_id: 'u1' } } };
      if (url.includes('api/v1/users/v1')) return { data: { data: { clinic_id: 'c1' } } }; // vetInClinic check
      if (url.includes('users/u1')) throw new Error('user catch coverage'); // ownerData/vetData catch blocks
      if (url.includes('billing/pricing')) throw new Error('billing catch coverage'); // billing catch block
      return { data: { data: {} } };
    });
    (appointmentRepo.findByVetDateTime as jest.Mock).mockResolvedValue(null);
    (vetblockRepo.findVetBlocksByVetAndDay as jest.Mock).mockResolvedValue([]); // No blocks
    (appointmentRepo.createAppointment as jest.Mock).mockResolvedValue({ id: 'appt_fb', clinic_id: 'c1', type: 'PRESENCIAL', owner_id: 'u1', appointment_date: '2025-01-01', start_time: '10:00', veterinarian_id: 'v1' });
    const resFallback = await bookAppointment(userOwner, body, mockToken);
    expect(resFallback.id).toEqual('appt_fb');

    // Wait for background tasks
    await new Promise(r => setTimeout(r, 150));
  });

  it('editAppointment and changeAppointmentStatus coverage (unit - 5)', async () => {
    const userAdmin = { id: 'a1', sub: 'a1', role: 'CLINIC_ADMIN', clinic_id: 'c1' } as any;
    
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt1', clinic_id: 'c1', owner_id: 'u1', status: 'PENDING' });
    (appointmentRepo.updateAppointment as jest.Mock).mockResolvedValue({ id: 'appt1', reason: 'Update' });
    const resEdit = await editAppointment('appt1', userAdmin, { reason: 'Update' } as any, mockToken);
    expect(resEdit.id).toEqual('appt1');

    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
    const resStatus = await changeAppointmentStatus('appt1', userAdmin, 'CONFIRMED');
    expect(resStatus.status).toEqual('CONFIRMED');

    const userOwner = { id: 'u1', sub: 'u1', role: 'DUENO_MASCOTA' } as any;
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'CONFIRMED' });
    await expect(editAppointment('appt2', userOwner, { reason: 'U' } as any, mockToken)).rejects.toThrow('Solo puedes editar citas en estado PENDING');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValueOnce(null);
    await expect(editAppointment('appt2', userAdmin, { reason: 'U' } as any, mockToken)).rejects.toThrow('Cita no encontrada');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'other', status: 'PENDING' });
    await expect(editAppointment('appt2', userOwner, { reason: 'U' } as any, mockToken)).rejects.toThrow('Sin permisos para editar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c2', owner_id: 'u1', status: 'PENDING' });
    await expect(editAppointment('appt2', userAdmin, { reason: 'U' } as any, mockToken)).rejects.toThrow('Sin permisos para editar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'COMPLETED' });
    await expect(editAppointment('appt2', userAdmin, { reason: 'U' } as any, mockToken)).rejects.toThrow('No se puede editar una cita COMPLETED o CANCELLED');

    // (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'PENDING', appointment_date: '2025-01-01', start_time: '10:00', veterinarian_id: 'v1' });
    // (appointmentRepo.findByVetDateTime as jest.Mock).mockReturnValue(Promise.resolve({ id: 'other' }));
    // await expect(editAppointment('appt2', userAdmin, { start_time: '11:00' } as any, mockToken)).rejects.toThrow('El nuevo slot ya está ocupado');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValueOnce(null);
    await expect(changeAppointmentStatus('appt2', userOwner, 'CANCELLED')).rejects.toThrow('Cita no encontrada');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'other', status: 'PENDING' });
    await expect(changeAppointmentStatus('appt2', userOwner, 'CANCELLED')).rejects.toThrow('Sin permisos para cambiar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'PENDING' });
    await expect(changeAppointmentStatus('appt2', userOwner, 'CONFIRMED')).rejects.toThrow('DUENO_MASCOTA solo puede cancelar citas');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'COMPLETED' });
    await expect(changeAppointmentStatus('appt2', userOwner, 'CANCELLED')).rejects.toThrow('Solo puedes cancelar citas en estado PENDING o CONFIRMED');

    const userVet = { id: 'v1', sub: 'v1', role: 'VETERINARIO', clinic_id: 'c1' } as any;
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c2', owner_id: 'u1', status: 'PENDING' });
    await expect(changeAppointmentStatus('appt2', userVet, 'COMPLETED')).rejects.toThrow('Sin permisos para cambiar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'PENDING' });
    await expect(changeAppointmentStatus('appt2', userVet, 'CONFIRMED')).rejects.toThrow('VETERINARIO solo puede marcar citas como COMPLETED o NO_SHOW');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c2', owner_id: 'u1', status: 'PENDING' });
    await expect(changeAppointmentStatus('appt2', userAdmin, 'CONFIRMED')).rejects.toThrow('Sin permisos para cambiar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt2', clinic_id: 'c1', owner_id: 'u1', status: 'PENDING' });
    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({ id: 'appt2', status: 'CANCELLED', clinic_id: 'c1', owner_id: 'u1' });
    await changeAppointmentStatus('appt2', userAdmin, 'CANCELLED');
    
    (appointmentRepo.patchAppointmentStatus as jest.Mock).mockResolvedValue({ id: 'appt2', status: 'COMPLETED', clinic_id: 'c1', pet_id: 'p1', veterinarian_id: 'v1' });
    await changeAppointmentStatus('appt2', userAdmin, 'COMPLETED');
  });

  it('removeAppointment coverage (unit - 6)', async () => {
    const userAdmin = { id: 'a1', sub: 'a1', role: 'CLINIC_ADMIN', clinic_id: 'c1' } as any;
    
    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValueOnce(null);
    await expect(removeAppointment('appt1', userAdmin)).rejects.toThrow('Cita no encontrada');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValueOnce({ id: 'appt1', clinic_id: 'c2', status: 'PENDING' });
    await expect(removeAppointment('appt1', userAdmin)).rejects.toThrow('Sin permisos para eliminar esta cita');

    (appointmentRepo.findAppointmentById as jest.Mock).mockResolvedValue({ id: 'appt1', clinic_id: 'c1', status: 'PENDING' });
    (appointmentRepo.deleteAppointment as jest.Mock).mockResolvedValue(undefined);

    await expect(removeAppointment('appt1', userAdmin)).resolves.toBeUndefined();
  });
});
