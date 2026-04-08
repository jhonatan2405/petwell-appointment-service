import axios from 'axios';
import { findVetBlocksByVetAndDay, findVetBlocksByClinicAndDay } from '../repositories/vetblock.repository';
import { findTakenSlotsForVet } from '../repositories/appointment.repository';
import { generateSlots, filterAvailableSlots } from '../utils/slots.util';
import { env } from '../config/env';

export interface AvailabilityQuery {
  clinic_id: string;
  date: string;             // YYYY-MM-DD
  veterinarian_id?: string;
  authToken?: string;       // forwarded to User Service for vet names
}

/** Enriched slot returned to the frontend */
export interface EnrichedSlot {
  start_time: string;
  end_time: string;
  veterinarian_id: string;
  veterinarian_name?: string;
}

/**
 * Convert YYYY-MM-DD to day-of-week (0=Sun … 6=Sat).
 */
function getDayOfWeek(date: string): number {
  const d = new Date(date + 'T00:00:00');
  return d.getUTCDay(); // 0=Sun ... 6=Sat
}

/**
 * Attempt to resolve a veterinarian's display name from User Service.
 * Returns undefined silently on any failure (graceful degradation).
 */
async function fetchVetName(
  veterinarianId: string,
  authToken?: string,
): Promise<string | undefined> {
  if (!authToken) return undefined;
  try {
    const { data } = await axios.get(
      `${env.USER_SERVICE_URL}/api/v1/users/${veterinarianId}`,
      { headers: { Authorization: `Bearer ${authToken}` }, timeout: 3000 },
    );
    const user = data?.data;
    if (!user) return undefined;
    // Try common name fields from User Service
    return (
      user.name ??
      user.full_name ??
      (user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : undefined)
    );
  } catch {
    return undefined;
  }
}

/**
 * Compute available enriched slots for a single vet on a given date.
 */
async function computeSlotsForVet(
  veterinarianId: string,
  date: string,
  dayOfWeek: number,
  authToken?: string,
): Promise<EnrichedSlot[]> {
  const [blocks, takenSlots] = await Promise.all([
    findVetBlocksByVetAndDay(veterinarianId, dayOfWeek),
    findTakenSlotsForVet(veterinarianId, date),
  ]);

  const allSlots = blocks.flatMap(block =>
    generateSlots(block.start_time, block.end_time, block.slot_duration),
  );

  const available = filterAvailableSlots(allSlots, takenSlots);
  if (available.length === 0) return [];

  const veterinarian_name = await fetchVetName(veterinarianId, authToken);

  return available.map(slot => ({
    ...slot,
    veterinarian_id: veterinarianId,
    ...(veterinarian_name ? { veterinarian_name } : {}),
  }));
}

/**
 * Main entry point.
 * - With veterinarian_id → returns slots for that vet only (backwards-compatible).
 * - Without veterinarian_id → returns enriched slots for ALL vets in the clinic
 *   that have active blocks on that day, sorted by start_time then vet.
 */
export async function getAvailableSlots(query: AvailabilityQuery): Promise<EnrichedSlot[]> {
  const dayOfWeek = getDayOfWeek(query.date);

  if (query.veterinarian_id) {
    // Single-vet path — preserves original behaviour
    return computeSlotsForVet(query.veterinarian_id, query.date, dayOfWeek, query.authToken);
  }

  // All-vets path: pull blocks for the clinic on that day, dedupe vets
  const blocks = await findVetBlocksByClinicAndDay(query.clinic_id, dayOfWeek);
  if (blocks.length === 0) return [];

  const uniqueVetIds = [...new Set(blocks.map(b => b.veterinarian_id))];

  // Resolve each vet's slots in parallel
  const perVetSlots = await Promise.all(
    uniqueVetIds.map(vetId =>
      computeSlotsForVet(vetId, query.date, dayOfWeek, query.authToken),
    ),
  );

  // Flatten and sort by start_time so frontend gets a clean list
  return perVetSlots
    .flat()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// Re-exported for appointment.service.ts (end_time calculation)
export { computeSlotsForVet };
