import { eld } from 'eld/medium';
export const UNKNOWN_LANGUAGE_ALPHA2 = 'xx';
export function guessLanguageAlpha2(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) {
    return UNKNOWN_LANGUAGE_ALPHA2;
  }
  const { language } = eld.detect(trimmed);
  return language || UNKNOWN_LANGUAGE_ALPHA2;
}
