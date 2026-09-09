import { randomUUID } from 'node:crypto';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { DeadLetterEnvelope } from './messages.js';
export async function peekDeadLetterMessages(
  brokers: string[],
  topic: string,
  limit: number,
  timeoutMs = 5000,
): Promise<DeadLetterEnvelope[]> {
  const kafka = new KafkaJS.Kafka({
    kafkaJS: { brokers, logLevel: KafkaJS.logLevel.NOTHING },
  });
  const consumer = kafka.consumer({
    kafkaJS: { groupId: `lens-scraper-dlq-inspector-${randomUUID()}` },
  });
  const envelopes: DeadLetterEnvelope[] = [];
  await consumer.connect();
  try {
    await consumer.subscribe({ topic, fromBeginning: true });
    await new Promise<void>((resolve) => {
      let settled = false;
      const timer = setTimeout(finish, timeoutMs);
      function finish(): void {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      }
      consumer
        .run({
          eachMessage: async ({ message }) => {
            if (message.value) {
              envelopes.push(
                JSON.parse(message.value.toString()) as DeadLetterEnvelope,
              );
            }
            if (envelopes.length >= limit) {
              finish();
            }
          },
        })
        .catch(finish);
    });
  } finally {
    await consumer.disconnect();
  }
  return envelopes;
}
