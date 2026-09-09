import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ALL_DEAD_LETTER_TOPICS, ALL_TOPICS } from './topics.js';

export async function provisionTopicRetention(
  brokers: string[],
  retentionMs: number,
  dlqRetentionMs: number,
): Promise<void> {
  const kafka = new KafkaJS.Kafka({
    kafkaJS: { brokers, logLevel: KafkaJS.logLevel.NOTHING },
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const topicConfigs: KafkaJS.ITopicConfig[] = [
      ...ALL_TOPICS.map((topic) => topicConfig(topic, retentionMs)),
      ...ALL_DEAD_LETTER_TOPICS.map((topic) =>
        topicConfig(topic, dlqRetentionMs),
      ),
    ];
    await admin.createTopics({ topics: topicConfigs });
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
