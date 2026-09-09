import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordTitlesFilterRequestDto } from './record-titles-filter-request.dto.js';
describe('RecordTitlesFilterRequestDto', () => {
  it('passes validation for a non-empty array of strings', async () => {
    const dto = plainToInstance(RecordTitlesFilterRequestDto, {
      substrings: ['laptop', 'home'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  it('fails validation when substrings is an empty array', async () => {
    const dto = plainToInstance(RecordTitlesFilterRequestDto, {
      substrings: [],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayMinSize');
  });
  it('fails validation when substrings is not an array', async () => {
    const dto = plainToInstance(RecordTitlesFilterRequestDto, {
      substrings: 'laptop',
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isArray');
  });
  it('fails validation when substrings contains a non-string item', async () => {
    const dto = plainToInstance(RecordTitlesFilterRequestDto, {
      substrings: ['laptop', 42],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
