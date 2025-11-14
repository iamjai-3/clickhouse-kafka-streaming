# Quick Start Guide

## 1. Configure Environment (Optional)

Copy `.env.example` to `.env` and customize the number of records:

```bash
cp .env.example .env
```

Edit `.env` to set record counts:

```env
PRODUCER_USERS_COUNT=10
PRODUCER_PRODUCTS_COUNT=10
PRODUCER_ORDERS_COUNT=20
```

## 2. Start Services

```bash
docker-compose up -d
```

Wait for all services to be ready (check with `docker-compose ps`)

## 3. Seed Initial Data (Optional)

```bash
npm run seed
```

## 4. Start Consumer

In one terminal, start the consumer:

```bash
npm run consumer
```

The consumer will:

- Connect to Kafka
- Create Kafka topics if they don't exist
- Initialize ClickHouse tables (processed_events, migration_logs)
- Wait for group coordinator to be ready
- Start listening for messages

## 5. Send Sample Data

In another terminal, run the producer:

```bash
npm run producer
```

This will send records based on your `.env` configuration (default: 10 users, 10 products, 20 orders).

To generate more records, update your `.env` file:

```env
PRODUCER_USERS_COUNT=100
PRODUCER_PRODUCTS_COUNT=50
PRODUCER_ORDERS_COUNT=200
```

## 6. Verify Data

### Check ClickHouse

```bash
# Using curl
curl -u admin:admin123 "http://localhost:8123?query=SELECT count() FROM users"
curl -u admin:admin123 "http://localhost:8123?query=SELECT count() FROM products"
curl -u admin:admin123 "http://localhost:8123?query=SELECT count() FROM orders"
```

### Check Migration Logs

```bash
curl -u admin:admin123 "http://localhost:8123?query=SELECT * FROM migration_logs ORDER BY processed_at DESC LIMIT 10"
```

### Check Logs

```bash
# View combined logs (batch-level summaries)
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log
```

**Note**: Logs show batch-level summaries, not individual record logs. Each batch log includes:

- Total messages processed
- Success/failure/duplicate counts
- Processing time
- Table-level statistics

## 7. Test Idempotency

Run the producer again - duplicate messages should be skipped:

```bash
npm run producer
```

Check the logs - you should see `duplicateCount` in batch summaries. Duplicate messages are automatically skipped and counted in the batch statistics.

## 8. Test DLQ

The Dead Letter Queue (DLQ) captures messages that fail validation or processing. Here's how to test it:

### Method 1: Use the DLQ Test Script (Recommended)

Run the built-in test script that sends 15 different types of invalid messages:

```bash
npm run test-dlq
```

This script sends various invalid messages:

- Invalid table names
- Missing required fields
- Invalid data types
- Invalid email formats
- Negative numbers where positive required
- Invalid enum values
- Zero/negative quantities
- Out-of-range values

### Method 2: Manual Testing

You can also manually send invalid messages using Kafka CLI or Kafka UI.

**Example invalid message:**

```json
{
  "table": "users",
  "data": {
    "id": 999,
    "email": "invalid-email"
  }
}
```

### Verify DLQ Messages

1. **Check Consumer Logs:**

   ```bash
   # View batch summaries with failures
   tail -f logs/combined.log | grep "failureCount"

   # View error logs
   tail -f logs/error.log
   ```

2. **Check Kafka UI:**

   - Open http://localhost:8080
   - Navigate to **Topics** → `dlq-topic`
   - Click **Messages** to view failed messages
   - Each DLQ message contains:
     - `originalMessage`: The original failed message
     - `error`: Error details (message and stack trace)
     - `reason`: Failure reason (`validation_error`, `processing_error`, etc.)
     - `timestamp`: When the message was sent to DLQ

3. **Check Batch Logs:**
   ```bash
   tail -f logs/combined.log
   ```
   Look for batch summaries with `failureCount > 0` and `tableStats` showing failures.

### What Happens When a Message Fails?

1. Consumer receives the message
2. Validation fails (Zod schema validation)
3. Error is logged to `error.log`
4. Message is sent to `dlq-topic` with error details via `sendToDLQ()`
5. Batch summary shows the failure count
6. Processing continues with other messages

## Monitoring

- **Kafka UI**: http://localhost:8080
- **ClickHouse HTTP**: http://localhost:8123
- **Logs**: `logs/` directory

## Troubleshooting

### Consumer not starting

- Check Kafka is running: `docker-compose ps kafka-broker-1`
- Check logs: `logs/combined.log`

### Messages not processing

- Verify topics exist in Kafka UI
- Check consumer logs for errors
- Verify ClickHouse is accessible

### Duplicate messages

- Check `processed_events` table
- Ensure `messageId` is unique in producer
