/* v8 ignore file */
export interface QueuePort {
  publish(topic: string, payload: unknown): Promise<void>;
}
