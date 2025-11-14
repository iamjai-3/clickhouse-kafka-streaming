# Kafka-ClickHouse Streaming POC

A production-ready streaming pipeline that consumes data from Kafka, validates it using Zod, transforms it, and inserts it into ClickHouse with idempotency, DLQ handling, and comprehensive logging.

## Features

- ✅ **Kafka Integration**: Producer and Consumer using KafkaJS
- ✅ **Data Validation**: Zod schemas for users, products, and orders
- ✅ **ClickHouse Integration**: Efficient data insertion with idempotency
- ✅ **Idempotency**: Prevents duplicate inserts using processed_events table
- ✅ **Dead Letter Queue (DLQ)**: Failed messages are sent to DLQ for reprocessing
- ✅ **Clean Logging**: Winston logger with batch-level summaries (error.log + combined.log)
- ✅ **Migration Logs**: Track all data migrations in ClickHouse
- ✅ **High Throughput**: Batch processing with aggregated logging and optimized Kafka consumer settings
- ✅ **Auto Topic Creation**: Topics are automatically created on consumer startup
- ✅ **Error Handling**: Robust error handling with retries and DLQ

## Architecture

```
External Source → Kafka Topics → Consumer → Validation (Zod) → Transformation → ClickHouse
                                                      ↓
                                                 DLQ (on errors)
```

## Prerequisites

- Docker and Docker Compose
- Node.js 16+ and npm

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment Variables** (Optional)

   Copy `.env.example` to `.env` and customize:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` to set the number of records to generate:

   ```env
   PRODUCER_USERS_COUNT=10
   PRODUCER_PRODUCTS_COUNT=10
   PRODUCER_ORDERS_COUNT=20
   ```

3. **Start Services**

   ```bash
   docker-compose up -d
   ```

4. **Wait for services to be ready** (about 30-60 seconds)

5. **Seed Initial Data** (Optional)
   ```bash
   npm run seed
   ```

## Usage

### Start Consumer

The consumer will listen to Kafka topics and process messages:

```bash
npm run consumer
# or
npm start
```

### Send Sample Data (Producer)

Generate and send sample data to Kafka:

```bash
npm run producer
```

## Configuration

Environment variables (optional, defaults provided):

```bash
# Kafka
KAFKA_BROKER=localhost:9094

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=test
CLICKHOUSE_USER=admin
CLICKHOUSE_PASSWORD=admin123

# Producer - Number of records to generate
PRODUCER_USERS_COUNT=10      # Default: 10
PRODUCER_PRODUCTS_COUNT=10   # Default: 10
PRODUCER_ORDERS_COUNT=20     # Default: 20

# Logging
LOG_LEVEL=info
NODE_ENV=development

# KafkaJS (auto-set, but can override)
KAFKAJS_NO_PARTITIONER_WARNING=1
```

### Producer Configuration

You can control how many records are generated for each table by setting these environment variables in your `.env` file:

- `PRODUCER_USERS_COUNT`: Number of user records to generate (default: 10)
- `PRODUCER_PRODUCTS_COUNT`: Number of product records to generate (default: 10)
- `PRODUCER_ORDERS_COUNT`: Number of order records to generate (default: 20)

Example: To generate 100 users, 50 products, and 200 orders:

```env
PRODUCER_USERS_COUNT=100
PRODUCER_PRODUCTS_COUNT=50
PRODUCER_ORDERS_COUNT=200
```

## Topics

Topics are automatically created when the consumer starts:

- `users-topic`: User data messages (3 partitions)
- `products-topic`: Product data messages (3 partitions)
- `orders-topic`: Order data messages (3 partitions)
- `dlq-topic`: Dead Letter Queue for failed messages (3 partitions)

## Database Tables

### Data Tables

- `users`: User information
- `products`: Product catalog
- `orders`: Order transactions

### System Tables

- `processed_events`: Tracks processed messages for idempotency
- `migration_logs`: Logs all data migration operations

## Logging

Logs are stored in the `logs/` directory:

- `combined.log`: All logs with batch-level summaries (no per-record logging)
- `error.log`: Error logs only

**Log Format**: Batch-level summaries show:

- Total messages processed per batch
- Success/failure/duplicate counts
- Processing time
- Table-level statistics

Example batch log:

```json
{
  "message": "Batch processed",
  "topic": "users-topic",
  "messageCount": 10,
  "successCount": 8,
  "failureCount": 0,
  "duplicateCount": 2,
  "processingTimeMs": 150,
  "tableStats": {
    "users": { "success": 8, "failure": 0, "duplicate": 2 }
  }
}
```

## Message Format

Messages should follow this structure:

```json
{
  "table": "users|products|orders",
  "data": {
    // Table-specific data
  },
  "messageId": "unique-message-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Idempotency

The system uses a `processed_events` table to track processed messages. Messages with the same `messageId`, `table_name`, and `record_id` are automatically skipped.

## DLQ (Dead Letter Queue)

Failed messages are automatically sent to the `dlq-topic` via the `sendToDLQ()` function with:

- `originalMessage`: The original failed message
- `error`: Error details (message and stack trace)
- `reason`: Failure reason (`validation_error`, `processing_error`, `connection_error`, `duplicate`, etc.)
- `timestamp`: When the message was sent to DLQ

### Testing DLQ

Use the built-in test script to send invalid messages:

```bash
npm run test-dlq
```

This sends 15 different types of invalid messages (invalid table names, missing fields, wrong data types, etc.) that will fail validation and be routed to DLQ.

**Verify DLQ messages:**

- Check Kafka UI: http://localhost:8080 → Topics → `dlq-topic`
- Check logs: `tail -f logs/combined.log | grep "failureCount"`
- Check error logs: `tail -f logs/error.log`

## Monitoring

### Check Migration Logs

Query the migration_logs table in ClickHouse:

```sql
SELECT * FROM migration_logs
ORDER BY processed_at DESC
LIMIT 100;
```

### Check Processed Events Stats

```sql
SELECT table_name, count() as processed_count
FROM processed_events
GROUP BY table_name;
```

### Check DLQ Messages

Use Kafka UI at http://localhost:8080 to inspect DLQ messages.

## Access Points

- **Kafka UI**: http://localhost:8080
- **Kafka External**: localhost:9094
- **ClickHouse HTTP**: http://localhost:8123
- **ClickHouse Native**: localhost:9000

## Development

### Project Structure

```
.
├── src/
│   ├── schemas/
│   │   └── validation.js         # Zod validation schemas
│   ├── utils/
│   │   ├── kafka-config.js       # Kafka configuration & topic management
│   │   ├── clickhouse-client.js   # ClickHouse client with idempotency
│   │   └── logger.js              # Winston logger (batch-level logging)
│   ├── producer.js                # Kafka producer (uses Faker.js)
│   ├── consumer.js                # Kafka consumer with batch processing
│   └── test-dlq.js                # DLQ testing script
├── logs/                          # Application logs (error.log + combined.log)
├── docker-compose.yml             # Docker services (Kafka + ClickHouse)
├── seed-clickhouse.js             # Initial data seeding
├── .env.example                   # Environment variables template
└── package.json                   # Dependencies & scripts
```

## Troubleshooting

### Consumer not processing messages

1. Check Kafka is running: `docker-compose ps`
2. Check consumer logs: `logs/combined.log`
3. Verify topics exist in Kafka UI

### Duplicate messages

- Check `processed_events` table
- Ensure `messageId` is unique per message

### Messages in DLQ

1. Check error logs: `logs/error.log`
2. Inspect DLQ topic in Kafka UI
3. Review migration_logs table for error details

## License

ISC
