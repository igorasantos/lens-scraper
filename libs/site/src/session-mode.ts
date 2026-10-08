import type { BrowserContextKind } from '@app/browser';
export const SESSION_MODES = ['logged-in', 'logged-out'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export function isSessionMode(value: unknown): value is SessionMode {
  return SESSION_MODES.includes(value as SessionMode);
}
export function browserContextForMode(mode: SessionMode): BrowserContextKind {
  return mode === 'logged-in' ? 'persistent' : 'ephemeral';
}
