export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitUntil(targetTimestamp: number): Promise<void> {
  const delayMs = targetTimestamp - Date.now();
  return delayMs > 0 ? sleep(delayMs) : Promise.resolve();
}
