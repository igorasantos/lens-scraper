import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListingInitRequestDto } from './listing-init-request.dto.js';
describe('ListingInitRequestDto', () => {
  it('passes validation when baseUrl is omitted', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when baseUrl is a non-empty string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      baseUrl: 'https://example.com',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when baseUrl is an empty string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { baseUrl: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
  it('fails validation when baseUrl is not a string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { baseUrl: 123 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
  it('passes validation when startPage is omitted', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when startPage is a positive integer', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { startPage: 3 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when startPage is 0', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { startPage: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });
  it('fails validation when startPage is negative', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { startPage: -1 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });
  it('fails validation when startPage is not an integer', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { startPage: 1.5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
  it('passes validation when recycle is a boolean', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { recycle: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when recycle is not a boolean', async () => {
    const dto = plainToInstance(ListingInitRequestDto, { recycle: 'yes' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });
  it('passes validation when dispatchCount is omitted or a positive integer', async () => {
    expect(
      await validate(plainToInstance(ListingInitRequestDto, {})),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ListingInitRequestDto, { dispatchCount: 5 }),
      ),
    ).toHaveLength(0);
  });
  it('fails validation when dispatchCount is 0 or not an integer', async () => {
    const zero = await validate(
      plainToInstance(ListingInitRequestDto, { dispatchCount: 0 }),
    );
    expect(zero[0].constraints).toHaveProperty('min');
    const fractional = await validate(
      plainToInstance(ListingInitRequestDto, { dispatchCount: 1.5 }),
    );
    expect(fractional[0].constraints).toHaveProperty('isInt');
  });
});
