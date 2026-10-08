import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListingInitRequestDto } from './listing-init-request.dto.js';
describe('ListingInitRequestDto', () => {
  const modes = { listing_mode: 'logged-in', detail_mode: 'logged-out' };
  it('fails validation when listing_mode or detail_mode is missing', async () => {
    const errors = await validate(plainToInstance(ListingInitRequestDto, {}));
    expect(errors.map((error) => error.property).sort()).toEqual([
      'detail_mode',
      'listing_mode',
    ]);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
  it('fails validation when a mode is not logged-in or logged-out', async () => {
    const errors = await validate(
      plainToInstance(ListingInitRequestDto, {
        ...modes,
        listing_mode: 'logged_in',
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('listing_mode');
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
  it('passes validation with every combination of listing and detail modes', async () => {
    for (const listing_mode of ['logged-in', 'logged-out']) {
      for (const detail_mode of ['logged-in', 'logged-out']) {
        expect(
          await validate(
            plainToInstance(ListingInitRequestDto, {
              listing_mode,
              detail_mode,
            }),
          ),
        ).toHaveLength(0);
      }
    }
  });
  it('passes validation when baseUrl is omitted', async () => {
    const dto = plainToInstance(ListingInitRequestDto, modes);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when baseUrl is a non-empty string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      baseUrl: 'https://example.com',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when baseUrl is an empty string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      baseUrl: '',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
  it('fails validation when baseUrl is not a string', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      baseUrl: 123,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
  it('passes validation when startPage is omitted', async () => {
    const dto = plainToInstance(ListingInitRequestDto, modes);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('passes validation when startPage is a positive integer', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      startPage: 3,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when startPage is 0', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      startPage: 0,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });
  it('fails validation when startPage is negative', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      startPage: -1,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });
  it('fails validation when startPage is not an integer', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      startPage: 1.5,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
  it('passes validation when recycle is a boolean', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      recycle: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when recycle is not a boolean', async () => {
    const dto = plainToInstance(ListingInitRequestDto, {
      ...modes,
      recycle: 'yes',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });
  it('passes validation when dispatchCount is omitted or a positive integer', async () => {
    expect(
      await validate(plainToInstance(ListingInitRequestDto, modes)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ListingInitRequestDto, { ...modes, dispatchCount: 5 }),
      ),
    ).toHaveLength(0);
  });
  it('fails validation when dispatchCount is 0 or not an integer', async () => {
    const zero = await validate(
      plainToInstance(ListingInitRequestDto, { ...modes, dispatchCount: 0 }),
    );
    expect(zero[0].constraints).toHaveProperty('min');
    const fractional = await validate(
      plainToInstance(ListingInitRequestDto, { ...modes, dispatchCount: 1.5 }),
    );
    expect(fractional[0].constraints).toHaveProperty('isInt');
  });
});
