export interface ScheduledRecord {
  recordId: string;
  scheduledAt: string;
}
export function stampScheduledAt(
  recordIds: string[],
  now: number = Date.now(),
): ScheduledRecord[] {
  const scheduledAt = new Date(now).toISOString();
  return recordIds.map((recordId) => ({ recordId, scheduledAt }));
}
