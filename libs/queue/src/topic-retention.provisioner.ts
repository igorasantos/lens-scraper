import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ALL_TOPICS } from './topics.js';

export async function provisionTopicRetention(
  brokers: string[],
  retentionMs: number,
): Promise<void> {
  const kafka = new KafkaJS.Kafka({
    kafkaJS: { brokers, logLevel: KafkaJS.logLevel.NOTHING },
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: ALL_TOPICS.map((topic) => topicConfig(topic, retentionMs)),
    });
  } finally {
    await admin.disconnect();
  }
}

function topicConfig(topic: string, retentionMs: number): KafkaJS.ITopicConfig {
  return {
    topic,
    configEntries: [{ name: 'retention.ms', value: String(retentionMs) }],
  };
}
