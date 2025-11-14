# Kafka-ClickHouse Streaming POC

A production-ready streaming pipeline that consumes data from Kafka, validates it using Zod, transforms it, and inserts it into ClickHouse with idempotency, DLQ handling, and comprehensive logging.

## Features

- ✅ **Kafka Integration**: Producer and Consumer using KafkaJS
- ✅ **Data Validation**: Zod schemas for users, products, and orders
- ✅ **ClickHouse Integration**: Efficient data insertion with idempotency
- ✅ **Idempotency**: Prevents duplicate inserts using processed_events table
- ✅ **Dead Letter Queue (DLQ)**: Failed messages are sent to DLQ for reprocessing
- ✅ **Comprehensive Logging**: Winston logger with table-specific log files
- ✅ **Migration Logs**: Track all data migrations in ClickHouse
- ✅ **High Throughput**: Batch processing and optimized Kafka consumer settings
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

- `users-topic`: User data messages
- `products-topic`: Product data messages
- `orders-topic`: Order data messages
- `dlq-topic`: Dead Letter Queue for failed messages

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

- `combined.log`: All logs
- `error.log`: Error logs only
- `users.log`: User table operations
- `products.log`: Product table operations
- `orders.log`: Order table operations

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

Failed messages are automatically sent to the `dlq-topic` with:

- Original message
- Error details
- Failure reason
- Timestamp

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
│   │   └── validation.js      # Zod validation schemas
│   ├── utils/
│   │   ├── kafka-config.js    # Kafka configuration
│   │   ├── clickhouse-client.js # ClickHouse client with idempotency
│   │   └── logger.js           # Winston logger setup
│   ├── producer.js            # Kafka producer
│   └── consumer.js            # Kafka consumer with processing
├── logs/                      # Application logs
├── docker-compose.yml         # Docker services
└── seed-clickhouse.js         # Initial data seeding
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
