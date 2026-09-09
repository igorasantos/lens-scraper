import { stampScheduledAt } from './schedule.js';
describe('stampScheduledAt', () => {
  it('stamps every record with the same scheduledAt', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    const result = stampScheduledAt(['a', 'b', 'c'], now);
    const expected = new Date(now).toISOString();
    expect(result).toEqual([
      { recordId: 'a', scheduledAt: expected },
      { recordId: 'b', scheduledAt: expected },
      { recordId: 'c', scheduledAt: expected },
    ]);
  });
  it('returns an empty array for an empty input', () => {
    expect(stampScheduledAt([])).toEqual([]);
  });
  it('defaults to Date.now() when no timestamp is given', () => {
    const before = Date.now();
    const [result] = stampScheduledAt(['a']);
    const after = Date.now();
    const scheduledAtMs = Date.parse(result.scheduledAt);
    expect(scheduledAtMs).toBeGreaterThanOrEqual(before);
    expect(scheduledAtMs).toBeLessThanOrEqual(after);
  });
});
