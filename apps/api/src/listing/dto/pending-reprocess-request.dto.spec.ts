import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PendingReprocessRequestDto,
  RUN_ID_PATTERN,
} from './pending-reprocess-request.dto.js';
describe('PendingReprocessRequestDto', () => {
  it('passes validation when recycle is omitted', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when recycle is a boolean', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, { recycle: false });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when recycle is not a boolean', async () => {
    const dto = plainToInstance(PendingReprocessRequestDto, { recycle: 1 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });
  it('RUN_ID_PATTERN accepts an ISO timestamp run id and rejects path separators', () => {
    expect(RUN_ID_PATTERN.test('2026-01-01T00:00:00.000Z')).toBe(true);
    expect(RUN_ID_PATTERN.test('../run')).toBe(false);
  });
});
