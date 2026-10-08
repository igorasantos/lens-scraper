/* v8 ignore file */
import type { SessionMode } from '@app/site';
export interface ListingInitMessage {
  runId: string;
  baseUrl: string;
  listingMode: SessionMode;
  detailMode: SessionMode;
  startPage?: number;
  recycle?: boolean;
  dispatchCount?: number;
}
export interface PendingReprocessMessage {
  runId: string;
  fromRunId: string;
  detailMode: SessionMode;
  recycle?: boolean;
  dispatchCount?: number;
}
export interface ListingPageMessage {
  runId: string;
  baseUrl: string;
  listingMode: SessionMode;
  detailMode: SessionMode;
  pagesVisited: number;
  recordIds: string[];
  lockToken: string;
  scheduledAt: string;
  recycle?: boolean;
  dispatchCount?: number;
}
export interface RecordsRecycleMessage {
  runId: string;
  detailMode: SessionMode;
  dispatchCount?: number;
}
export interface RecordDetailMessage {
  recordId: string;
  detailMode: SessionMode;
  scheduledAt: string;
  runId?: string;
}
export interface ExpiredReprocessMessage {
  runId: string;
  detailMode: SessionMode;
}
export interface XxReprocessMessage {
  runId: string;
  detailMode: SessionMode;
}
export interface RecordTitlesExtractMessage {
  runId: string;
}
export interface RecordTitleExtractMessage {
  runId: string;
  fileKey: string;
}
export interface RecordTitlesDedupSortMessage {
  runId: string;
}
export interface RecordTitlesFilterMessage {
  runId: string;
  substrings: string[];
}
export interface RecordsFilterMessage {
  runId: string;
}
export interface RecordFilterCopyMessage {
  runId: string;
  fileKey: string;
}
export interface RecordLanguageClassifyMessage {
  runId: string;
  recordId: string;
}
