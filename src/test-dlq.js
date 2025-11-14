import "dotenv/config";
import { fileURLToPath } from "url";
import { producer, TOPICS, ensureTopicsExist } from "./utils/kafka-config.js";
import { logger } from "./utils/logger.js";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);

// Test cases that will fail validation and trigger DLQ
const invalidMessages = [
  {
    name: "Invalid table name",
    message: {
      table: "invalid_table",
      data: { id: 1, name: "Test" },
      messageId: uuidv4(),
    },
  },
  {
    name: "Users: Missing required field (email)",
    message: {
      table: "users",
      data: {
        id: 999,
        name: "Test User",
        age: 25,
        city: "Test City",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Users: Invalid email format",
    message: {
      table: "users",
      data: {
        id: 999,
        name: "Test User",
        email: "invalid-email",
        age: 25,
        city: "Test City",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Users: Negative age",
    message: {
      table: "users",
      data: {
        id: 999,
        name: "Test User",
        email: "test@example.com",
        age: -5,
        city: "Test City",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Users: Age too high",
    message: {
      table: "users",
      data: {
        id: 999,
        name: "Test User",
        email: "test@example.com",
        age: 200,
        city: "Test City",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Products: Missing required field (price)",
    message: {
      table: "products",
      data: {
        id: 999,
        name: "Test Product",
        category: "Electronics",
        stock: 10,
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Products: Negative price",
    message: {
      table: "products",
      data: {
        id: 999,
        name: "Test Product",
        category: "Electronics",
        price: -10.99,
        stock: 10,
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Products: Negative stock",
    message: {
      table: "products",
      data: {
        id: 999,
        name: "Test Product",
        category: "Electronics",
        price: 10.99,
        stock: -5,
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Orders: Invalid status enum",
    message: {
      table: "orders",
      data: {
        id: 999,
        user_id: 1,
        product_id: 1,
        quantity: 2,
        total_price: 20.99,
        status: "invalid_status",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Orders: Missing required field (user_id)",
    message: {
      table: "orders",
      data: {
        id: 999,
        product_id: 1,
        quantity: 2,
        total_price: 20.99,
        status: "pending",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Orders: Zero quantity",
    message: {
      table: "orders",
      data: {
        id: 999,
        user_id: 1,
        product_id: 1,
        quantity: 0,
        total_price: 20.99,
        status: "pending",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Orders: Quantity too high",
    message: {
      table: "orders",
      data: {
        id: 999,
        user_id: 1,
        product_id: 1,
        quantity: 2000,
        total_price: 20.99,
        status: "pending",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Invalid JSON structure (missing table)",
    message: {
      data: {
        id: 999,
        name: "Test",
      },
      messageId: uuidv4(),
    },
  },
  {
    name: "Invalid data type (string instead of number)",
    message: {
      table: "users",
      data: {
        id: "not-a-number",
        name: "Test User",
        email: "test@example.com",
        age: 25,
        city: "Test City",
      },
      messageId: uuidv4(),
    },
  },
];

async function sendInvalidMessages() {
  try {
    logger.info("🧪 Starting DLQ Test - Sending invalid messages...");

    // Ensure topics exist
    await ensureTopicsExist();
    logger.info("✅ Topics verified/created");

    // Connect producer
    await producer.connect();
    logger.info("✅ Producer connected");

    // Determine which topic to send to based on table name
    function getTopicForTable(table) {
      switch (table) {
        case "users":
          return TOPICS.USERS;
        case "products":
          return TOPICS.PRODUCTS;
        case "orders":
          return TOPICS.ORDERS;
        default:
          return TOPICS.USERS; // Default fallback
      }
    }

    // Send all invalid messages
    let sentCount = 0;
    for (const testCase of invalidMessages) {
      try {
        const topic = testCase.message.table ? getTopicForTable(testCase.message.table) : TOPICS.USERS;

        await producer.send({
          topic,
          messages: [
            {
              key: `dlq-test-${Date.now()}-${sentCount}`,
              value: JSON.stringify(testCase.message),
              headers: {
                testCase: testCase.name,
                messageId: testCase.message.messageId ?? uuidv4(),
              },
            },
          ],
        });

        logger.info(`✅ Sent: ${testCase.name}`);
        sentCount++;

        // Small delay to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`❌ Failed to send test case "${testCase.name}"`, {
          error: error.message,
        });
      }
    }

    logger.info(`\n📊 Summary: Sent ${sentCount}/${invalidMessages.length} invalid messages`);
    logger.info("\n💡 Next steps:");
    logger.info("   1. Check consumer logs: tail -f logs/combined.log");
    logger.info("   2. Check error logs: tail -f logs/error.log");
    logger.info("   3. Check DLQ in Kafka UI: http://localhost:8080 → Topics → dlq-topic");
    logger.info("   4. Look for batch summaries with failureCount > 0");

    await producer.disconnect();
    logger.info("✅ Producer disconnected");
  } catch (error) {
    logger.error("Fatal error in DLQ test", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  sendInvalidMessages().catch((error) => {
    logger.error("Fatal error", { error: error.message });
    process.exit(1);
  });
}

export { sendInvalidMessages, invalidMessages };
