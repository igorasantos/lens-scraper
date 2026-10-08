import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordDetailsRequestDto } from './record-details-request.dto.js';
describe('RecordDetailsRequestDto', () => {
  it('passes validation with a detail mode and a list of record ids', async () => {
    const dto = plainToInstance(RecordDetailsRequestDto, {
      detail_mode: 'logged-in',
      records_to_reprocess: ['123', '456'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('fails validation when detail_mode or records_to_reprocess is missing', async () => {
    const errors = await validate(plainToInstance(RecordDetailsRequestDto, {}));
    expect(errors.map((error) => error.property).sort()).toEqual([
      'detail_mode',
      'records_to_reprocess',
    ]);
  });
  it('fails validation when detail_mode is not a known mode', async () => {
    const errors = await validate(
      plainToInstance(RecordDetailsRequestDto, {
        detail_mode: 'logged_out',
        records_to_reprocess: ['123'],
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
  it('fails validation when records_to_reprocess is not an array of strings', async () => {
    const notArray = await validate(
      plainToInstance(RecordDetailsRequestDto, {
        detail_mode: 'logged-out',
        records_to_reprocess: '123',
      }),
    );
    expect(notArray[0].constraints).toHaveProperty('isArray');
    const notStrings = await validate(
      plainToInstance(RecordDetailsRequestDto, {
        detail_mode: 'logged-out',
        records_to_reprocess: [123],
      }),
    );
    expect(notStrings[0].constraints).toHaveProperty('isString');
  });
});
