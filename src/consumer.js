import { fileURLToPath } from "url";

import { createConsumer, TOPICS, producer, ensureTopicsExist, waitForGroupCoordinator } from "./utils/kafka-config.js";
import { validateKafkaMessage } from "./schemas/validation.js";
import { insertWithIdempotency, initializeTables } from "./utils/clickhouse-client.js";
import { logger, logError, logTableOperation } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);

// Transform data to match ClickHouse schema
function transformToClickHouseSchema(table, validatedData) {
  const transformed = { ...validatedData };

  // Convert timestamps
  if (transformed.created_at && typeof transformed.created_at === "string") {
    transformed.created_at = transformed.created_at;
  } else if (!transformed.created_at) {
    transformed.created_at = new Date().toISOString().replace("T", " ").substring(0, 19);
  }

  if (transformed.order_date && typeof transformed.order_date === "string") {
    transformed.order_date = transformed.order_date;
  } else if (table === "orders" && !transformed.order_date) {
    transformed.order_date = new Date().toISOString().replace("T", " ").substring(0, 19);
  }

  // Ensure numeric types
  if (transformed.id) transformed.id = Number(transformed.id);
  if (transformed.user_id) transformed.user_id = Number(transformed.user_id);
  if (transformed.product_id) transformed.product_id = Number(transformed.product_id);
  if (transformed.quantity) transformed.quantity = Number(transformed.quantity);
  if (transformed.age) transformed.age = Number(transformed.age);
  if (transformed.stock) transformed.stock = Number(transformed.stock);
  if (transformed.price) transformed.price = parseFloat(transformed.price);
  if (transformed.total_price) transformed.total_price = parseFloat(transformed.total_price);

  return transformed;
}

// Send message to DLQ
async function sendToDLQ(originalMessage, error, reason) {
  try {
    const dlqMessage = {
      originalMessage: originalMessage,
      error: {
        message: error.message,
        stack: error.stack,
      },
      reason: reason,
      timestamp: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.DLQ,
      messages: [
        {
          key: `dlq-${Date.now()}`,
          value: JSON.stringify(dlqMessage),
          headers: {
            originalTopic: originalMessage.table ?? "unknown",
            errorReason: reason,
          },
        },
      ],
    });

    logger.warn(`Message sent to DLQ`, {
      reason,
      originalTable: originalMessage.table,
      error: error.message,
    });
  } catch (dlqError) {
    logger.error("Failed to send message to DLQ", {
      error: dlqError.message,
      originalError: error.message,
    });
  }
}

// Process a single message
async function processMessage(message) {
  const startTime = Date.now();
  let parsedMessage = null;

  try {
    // Parse message
    const messageValue = JSON.parse(message.value.toString());
    parsedMessage = messageValue;

    // Validate message
    const validated = validateKafkaMessage(messageValue);

    // Transform data
    const transformed = transformToClickHouseSchema(validated.table, validated.data);

    // Insert with idempotency
    const result = await insertWithIdempotency(
      validated.table,
      transformed,
      validated.messageId ?? message.headers?.messageId?.toString() ?? `auto-${Date.now()}`
    );

    // Return result for batch aggregation (no individual logging)
    return {
      success: result.success,
      reason: result.reason,
      table: validated.table,
      recordId: result.recordId,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Determine error type
    let errorReason = "validation_error";
    if (error.message?.includes("duplicate") || error.message?.includes("Duplicate")) {
      errorReason = "duplicate";
    } else if (error.message?.includes("validation") || error.name === "ZodError") {
      errorReason = "validation_error";
    } else if (error.message?.includes("connection") || error.message?.includes("timeout")) {
      errorReason = "connection_error";
    } else {
      errorReason = "processing_error";
    }

    logError(parsedMessage?.table ?? "unknown", "process_message", error, {
      messageId: parsedMessage?.messageId,
      processingTimeMs: processingTime,
      errorReason,
    });

    // Send to DLQ
    if (parsedMessage) {
      await sendToDLQ(parsedMessage, error, errorReason);
    }

    return { success: false, error: error.message, reason: errorReason };
  }
}

// Main consumer function
async function main() {
  const consumer = createConsumer();
  let isShuttingDown = false;

  // Graceful shutdown handler
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info("🛑 Shutting down consumer gracefully...");
    try {
      await consumer.disconnect();
      await producer.disconnect();
      logger.info("✅ Consumer disconnected");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error: error.message });
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    logger.info("🚀 Starting Kafka Consumer...");

    // Initialize ClickHouse tables
    await initializeTables();
    logger.info("✅ ClickHouse tables initialized");

    // Ensure topics exist before subscribing
    logger.info("📋 Ensuring Kafka topics exist...");
    await ensureTopicsExist();
    logger.info("✅ Topics verified/created");

    // Connect producer (for DLQ)
    await producer.connect();
    logger.info("✅ Producer connected for DLQ");

    // Connect consumer
    await consumer.connect();
    logger.info("✅ Consumer connected to Kafka");

    // Wait for group coordinator to be available (handles startup timing)
    logger.info("⏳ Waiting for group coordinator...");
    await waitForGroupCoordinator(consumer);

    // Subscribe to topics
    await consumer.subscribe({
      topics: [TOPICS.USERS, TOPICS.PRODUCTS, TOPICS.ORDERS],
      fromBeginning: false,
    });
    logger.info(`✅ Subscribed to topics: ${TOPICS.USERS}, ${TOPICS.PRODUCTS}, ${TOPICS.ORDERS}`);

    // Start consuming messages with batch processing for high throughput
    await consumer.run({
      eachBatch: async ({ batch }) => {
        const startTime = Date.now();

        // Process batch for better throughput
        const promises = batch.messages.map((message) => processMessage(message));
        const results = await Promise.allSettled(promises);

        // Aggregate results by table
        const tableStats = {};
        let successCount = 0;
        let failureCount = 0;
        let duplicateCount = 0;

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const { success, reason, table } = result.value;

            if (!tableStats[table]) {
              tableStats[table] = { success: 0, failure: 0, duplicate: 0 };
            }

            if (success) {
              successCount++;
              tableStats[table].success++;
            } else if (reason === "duplicate") {
              duplicateCount++;
              tableStats[table].duplicate++;
            } else {
              failureCount++;
              tableStats[table].failure++;
            }
          } else {
            failureCount++;
          }
        });

        const processingTime = Date.now() - startTime;

        // Log batch summary only (no per-record logging)
        logger.info(`Batch processed`, {
          topic: batch.topic,
          partition: batch.partition,
          messageCount: batch.messages.length,
          successCount,
          failureCount,
          duplicateCount,
          processingTimeMs: processingTime,
          tableStats,
        });
      },
    });
  } catch (error) {
    logError("system", "consumer_main", error);
    await shutdown();
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  main().catch((error) => {
    logger.error("Fatal error in consumer", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

export { processMessage, transformToClickHouseSchema };
