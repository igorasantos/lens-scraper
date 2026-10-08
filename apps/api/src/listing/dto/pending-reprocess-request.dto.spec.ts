import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PendingReprocessRequestDto,
  RUN_ID_PATTERN,
} from './pending-reprocess-request.dto.js';
describe('PendingReprocessRequestDto', () => {
  const modes = { detail_mode: 'logged-out' };
  it('fails validation when detail_mode is missing or not a known mode', async () => {
    for (const body of [{}, { detail_mode: 'anonymous' }]) {
      const errors = await validate(
        plainToInstance(PendingReprocessRequestDto, body),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('detail_mode');
      expect(errors[0].constraints).toHaveProperty('isIn');
    }
  });
  it('passes validation when recycle is omitted', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, modes);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when recycle is a boolean', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, {
      ...modes,
      recycle: false,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when recycle is not a boolean', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, {
      ...modes,
      recycle: 1,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });
  it('passes validation when dispatchCount is omitted or a positive integer', async () => {
    expect(
      await validate(plainToInstance(PendingReprocessRequestDto, modes)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PendingReprocessRequestDto, {
          ...modes,
          dispatchCount: 5,
        }),
      ),
    ).toHaveLength(0);
  });
  it('fails validation when dispatchCount is 0 or not an integer', async () => {
    const zero = await validate(
      plainToInstance(PendingReprocessRequestDto, {
        ...modes,
        dispatchCount: 0,
      }),
    );
    expect(zero[0].constraints).toHaveProperty('min');
    const fractional = await validate(
      plainToInstance(PendingReprocessRequestDto, {
        ...modes,
        dispatchCount: 1.5,
      }),
    );
    expect(fractional[0].constraints).toHaveProperty('isInt');
  });
  it('RUN_ID_PATTERN accepts an ISO timestamp run id and rejects path separators', () => {
    expect(RUN_ID_PATTERN.test('2026-01-01T00:00:00.000Z')).toBe(true);
    expect(RUN_ID_PATTERN.test('../run')).toBe(false);
  });
});
