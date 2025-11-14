import { Kafka, Partitioners } from "kafkajs";
import { logger } from "./logger.js";

// Kafka configuration
const kafka = new Kafka({
  clientId: "clickhouse-streaming-client",
  brokers: [process.env.KAFKA_BROKER ?? "localhost:9094"],
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Topic names
const TOPICS = {
  USERS: "users-topic",
  PRODUCTS: "products-topic",
  ORDERS: "orders-topic",
  DLQ: "dlq-topic", // Dead Letter Queue
};

// Consumer group
const CONSUMER_GROUP_ID = "clickhouse-consumer-group";

// Create producer with idempotency (ensures exactly-once semantics)
const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true, // Enables idempotency - prevents duplicate messages
  transactionTimeout: 30000,
  createPartitioner: Partitioners.DefaultPartitioner,
  retry: {
    retries: Infinity, // Unlimited retries for idempotent producer (maintains EoS guarantees)
    initialRetryTime: 100,
    multiplier: 2,
    maxRetryTime: 30000,
  },
});

// Create admin client for topic management
const admin = kafka.admin();

// Create topics if they don't exist
async function ensureTopicsExist() {
  try {
    await admin.connect();

    const topicList = Object.values(TOPICS);
    const existingTopics = await admin.listTopics();
    const topicsToCreate = topicList.filter((topic) => !existingTopics.includes(topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map((topic) => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
        })),
      });
      logger.info(`✅ Created topics: ${topicsToCreate.join(", ")}`);
    } else {
      logger.info("✅ All topics already exist");
    }
  } catch (error) {
    logger.error("Error ensuring topics exist", { error: error.message });
    throw error;
  } finally {
    await admin.disconnect();
  }
}

// Create consumer with retry configuration for group coordinator
function createConsumer(groupId = CONSUMER_GROUP_ID) {
  return kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    minBytes: 1,
    maxBytes: 10485760, // 10MB
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 300,
      retries: 10,
      multiplier: 2,
      maxRetryTime: 30000,
    },
  });
}

// Wait for group coordinator to be available (handles startup timing issues)
async function waitForGroupCoordinator(consumer, maxRetries = 15, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await consumer.describeGroup();
      logger.info("✅ Group coordinator is available");
      return true;
    } catch (error) {
      const isCoordinatorError = /coordinator|not available/i.test(error.message ?? "");

      if (!isCoordinatorError || i === maxRetries - 1) {
        if (i === maxRetries - 1) {
          logger.warn("Group coordinator not available, continuing anyway...");
        }
        return !isCoordinatorError;
      }

      logger.info(`⏳ Waiting for group coordinator... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 5000);
    }
  }
  return false;
}

export {
  kafka,
  producer,
  admin,
  createConsumer,
  ensureTopicsExist,
  waitForGroupCoordinator,
  TOPICS,
  CONSUMER_GROUP_ID,
};
