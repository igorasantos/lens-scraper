import { Injectable } from '@nestjs/common';
import { StorageService } from '@app/storage';
import {
  ListingDispatchService,
  type ListingDispatchResult,
} from './listing-dispatch.service.js';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class PendingReprocessService {
  constructor(
    private readonly storage: StorageService,
    private readonly dispatch: ListingDispatchService,
  ) {}
  async run(runId: string, fromRunId: string): Promise<ListingDispatchResult> {
    const recordIds = await this.storage.readRawListingIds(fromRunId);
    return this.dispatch.dispatch(runId, recordIds);
  }
}
