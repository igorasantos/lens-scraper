export const SCRAPE_LISTING_INIT_TOPIC = 'scrape.listing.init';
export const SCRAPE_LISTING_PAGE_TOPIC = 'scrape.listing.page';
export const SCRAPE_RECORD_DETAIL_TOPIC = 'scrape.record.detail';
export const SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC =
  'scrape.records.expired.reprocess';
export const SCRAPE_RECORDS_XX_REPROCESS_TOPIC = 'scrape.records.xx.reprocess';
export const SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC =
  'scrape.records.pending.reprocess';
export const SCRAPE_RECORDS_RECYCLE_TOPIC = 'scrape.records.recycle';
export const SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC =
  'scrape.records.titles.extract';
export const SCRAPE_RECORD_TITLE_EXTRACT_TOPIC = 'scrape.record.title.extract';
export const SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC =
  'scrape.record.titles.dedup-sort';
export const SCRAPE_RECORD_TITLES_FILTER_TOPIC = 'scrape.record.titles.filter';
export const SCRAPE_RECORDS_FILTER_TOPIC = 'scrape.records.filter';
export const SCRAPE_RECORD_FILTER_COPY_TOPIC = 'scrape.record.filter.copy';
export const SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC =
  'scrape.record.language.classify';
export const ALL_TOPICS = [
  SCRAPE_LISTING_INIT_TOPIC,
  SCRAPE_LISTING_PAGE_TOPIC,
  SCRAPE_RECORD_DETAIL_TOPIC,
  SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
  SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
  SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
  SCRAPE_RECORDS_RECYCLE_TOPIC,
  SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
  SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
  SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
  SCRAPE_RECORD_TITLES_FILTER_TOPIC,
  SCRAPE_RECORDS_FILTER_TOPIC,
  SCRAPE_RECORD_FILTER_COPY_TOPIC,
  SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
] as const;
