/* v8 ignore file */
export interface ListingInitMessage {
  runId: string;
  baseUrl: string;
  startPage?: number;
  recycle?: boolean;
}
export interface PendingReprocessMessage {
  runId: string;
  fromRunId: string;
  recycle?: boolean;
}
export interface ListingPageMessage {
  runId: string;
  baseUrl: string;
  pagesVisited: number;
  recordIds: string[];
  lockToken: string;
  scheduledAt: string;
  recycle?: boolean;
}
export interface RecordsRecycleMessage {
  runId: string;
}
export interface RecordDetailMessage {
  recordId: string;
  scheduledAt: string;
  runId?: string;
}
export interface ExpiredReprocessMessage {
  runId: string;
}
export interface XxReprocessMessage {
  runId: string;
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
export interface DeadLetterEnvelope<T = unknown> {
  topic: string;
  payload: T;
  attempts: number;
  error: {
    message: string;
    stack?: string;
  };
  failedAt: string;
}
