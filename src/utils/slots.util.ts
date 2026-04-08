// ─── Slot Generator Utility ─────────────────────────────────────────────────
// Generates time slots from a vet block; returns array of {start_time, end_time}

export interface TimeSlot {
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
}

/**
 * Convert "HH:MM" or "HH:MM:SS" to total minutes since midnight.
 */
function toMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/**
 * Convert total minutes since midnight to "HH:MM".
 */
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Generate all time slots in a block.
 * @param startTime  "HH:MM" start of block
 * @param endTime    "HH:MM" end of block
 * @param duration   slot duration in minutes
 */
export function generateSlots(
  startTime: string,
  endTime: string,
  duration: number,
): TimeSlot[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots: TimeSlot[] = [];

  for (let cur = start; cur + duration <= end; cur += duration) {
    slots.push({
      start_time: fromMinutes(cur),
      end_time: fromMinutes(cur + duration),
    });
  }

  return slots;
}

/**
 * Filter out slots that overlap with existing taken slots.
 * @param slots       All generated slots
 * @param takenSlots  Slots already booked (start_time strings)
 */
export function filterAvailableSlots(
  slots: TimeSlot[],
  takenSlots: string[],
): TimeSlot[] {
  const takenSet = new Set(takenSlots.map(t => t.substring(0, 5)));
  return slots.filter(s => !takenSet.has(s.start_time));
}
