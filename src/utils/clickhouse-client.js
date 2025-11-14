import { createClient } from "@clickhouse/client";
import { logger, logTableOperation, logError } from "./logger.js";

// ClickHouse client configuration
const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
  database: process.env.CLICKHOUSE_DB ?? "test",
  username: process.env.CLICKHOUSE_USER ?? "admin",
  password: process.env.CLICKHOUSE_PASSWORD ?? "admin123",
});

// Create processed events table for idempotency
async function createProcessedEventsTable() {
  try {
    await clickhouseClient.command({
      query: `
        CREATE TABLE IF NOT EXISTS processed_events (
          message_id String,
          table_name String,
          record_id UInt64,
          processed_at DateTime DEFAULT now(),
          PRIMARY KEY (message_id)
        ) ENGINE = ReplacingMergeTree(processed_at)
        ORDER BY (message_id, table_name, record_id)
      `,
    });
    logger.info("Processed events table created/verified");
  } catch (error) {
    logError("system", "create_processed_events_table", error);
    throw error;
  }
}

// Create migration log table
async function createMigrationLogTable() {
  try {
    await clickhouseClient.command({
      query: `
        CREATE TABLE IF NOT EXISTS migration_logs (
          id UUID DEFAULT generateUUIDv4(),
          table_name String,
          record_id UInt64,
          message_id String,
          status String,
          operation String,
          error_message String,
          processed_at DateTime DEFAULT now(),
          metadata String
        ) ENGINE = MergeTree()
        ORDER BY (table_name, processed_at, record_id)
      `,
    });
    logger.info("Migration log table created/verified");
  } catch (error) {
    logError("system", "create_migration_log_table", error);
    throw error;
  }
}

// Check if message was already processed (idempotency)
async function isDuplicate(messageId, tableName, recordId) {
  try {
    const result = await clickhouseClient.query({
      query: `
        SELECT count() as count
        FROM processed_events
        WHERE message_id = {messageId:String}
          AND table_name = {tableName:String}
          AND record_id = {recordId:UInt64}
      `,
      query_params: {
        messageId: messageId ?? "",
        tableName: tableName,
        recordId: recordId,
      },
      format: "JSONEachRow",
    });

    const rows = await result.json();
    return rows[0]?.count > 0;
  } catch (error) {
    logError(tableName, "check_duplicate", error, { messageId, recordId });
    // If check fails, assume not duplicate to avoid blocking
    return false;
  }
}

// Record message as processed
async function recordProcessed(messageId, tableName, recordId) {
  try {
    await clickhouseClient.insert({
      table: "processed_events",
      values: [
        {
          message_id: messageId ?? `auto-${Date.now()}-${Math.random()}`,
          table_name: tableName,
          record_id: recordId,
        },
      ],
      format: "JSONEachRow",
    });
  } catch (error) {
    logError(tableName, "record_processed", error, { messageId, recordId });
  }
}

// Log migration operation
async function logMigration(tableName, recordId, messageId, status, operation, errorMessage = null, metadata = {}) {
  try {
    await clickhouseClient.insert({
      table: "migration_logs",
      values: [
        {
          table_name: tableName,
          record_id: recordId,
          message_id: messageId ?? "",
          status: status, // success, error, duplicate
          operation: operation, // insert, update, skip
          error_message: errorMessage ?? "",
          metadata: JSON.stringify(metadata),
        },
      ],
      format: "JSONEachRow",
    });
  } catch (error) {
    logger.error("Failed to log migration", { error: error.message, tableName, recordId });
  }
}

// Insert data into ClickHouse table with idempotency check
async function insertWithIdempotency(tableName, data, messageId) {
  const recordId = data.id ?? data.user_id ?? data.product_id;

  // Check for duplicates
  const isDup = await isDuplicate(messageId, tableName, recordId);
  if (isDup) {
    // Only log migration, no verbose logging for duplicates
    await logMigration(tableName, recordId, messageId, "duplicate", "skip", null, { reason: "Duplicate message" });
    return { success: false, reason: "duplicate" };
  }

  try {
    // Insert data
    await clickhouseClient.insert({
      table: tableName,
      values: [data],
      format: "JSONEachRow",
    });

    // Record as processed
    await recordProcessed(messageId, tableName, recordId);

    // Log migration to ClickHouse (for tracking), but no verbose console/file logging
    await logMigration(tableName, recordId, messageId, "success", "insert", null, {});

    return { success: true, recordId };
  } catch (error) {
    logError(tableName, "insert", error, { messageId, recordId });
    await logMigration(tableName, recordId, messageId, "error", "insert", error.message, {});
    throw error;
  }
}

// Initialize tables
async function initializeTables() {
  await createProcessedEventsTable();
  await createMigrationLogTable();
}

export { clickhouseClient, insertWithIdempotency, initializeTables, isDuplicate, recordProcessed, logMigration };
