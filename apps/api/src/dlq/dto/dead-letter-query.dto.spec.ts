import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeadLetterQueryDto } from './dead-letter-query.dto.js';
describe('DeadLetterQueryDto', () => {
  it('passes validation when limit is omitted', async () => {
    const dto = plainToInstance(DeadLetterQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation and coerces a numeric string limit within range', async () => {
    const dto = plainToInstance(DeadLetterQueryDto, { limit: '50' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
  });
  it('fails validation when limit is below the minimum', async () => {
    const dto = plainToInstance(DeadLetterQueryDto, { limit: '0' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });
  it('fails validation when limit is above the maximum', async () => {
    const dto = plainToInstance(DeadLetterQueryDto, { limit: '101' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('max');
  });
  it('fails validation when limit is not an integer', async () => {
    const dto = plainToInstance(DeadLetterQueryDto, { limit: 'abc' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
});
