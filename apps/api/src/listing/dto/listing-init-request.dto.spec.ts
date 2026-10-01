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
});
