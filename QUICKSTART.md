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
- Initialize ClickHouse tables (processed_events, migration logs)
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
# View combined logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# View table-specific logs
tail -f logs/users.log
```

## 7. Test Idempotency

Run the producer again - duplicate messages should be skipped:

```bash
npm run producer
```

Check the logs - you should see "skip_duplicate" messages.

## 8. Test DLQ

To test DLQ, you can send invalid data. The consumer will:

1. Validate the message (fail validation)
2. Send to DLQ topic
3. Log the error

Check DLQ in Kafka UI: http://localhost:8080

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
