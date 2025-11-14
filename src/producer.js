// Load environment variables
import "dotenv/config";
import { fileURLToPath } from "url";

import { producer, TOPICS } from "./utils/kafka-config.js";
import { logger } from "./utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";

const __filename = fileURLToPath(import.meta.url);

// Sample data generators using Faker.js
function generateSampleUsers(count = 10) {
  const users = [];

  for (let i = 1; i <= count; i++) {
    users.push({
      table: "users",
      data: {
        id: i,
        name: faker.person.fullName(),
        email: faker.internet.email(),
        age: faker.number.int({ min: 18, max: 80 }),
        city: faker.location.city(),
      },
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
    });
  }
  return users;
}

function generateSampleProducts(count = 10) {
  const products = [];
  const categories = ["Electronics", "Furniture", "Clothing", "Books", "Sports", "Home & Garden", "Toys", "Automotive"];

  for (let i = 1; i <= count; i++) {
    products.push({
      table: "products",
      data: {
        id: i,
        name: faker.commerce.productName(),
        category: faker.helpers.arrayElement(categories),
        price: parseFloat(faker.commerce.price({ min: 10, max: 1000, dec: 2 })),
        stock: faker.number.int({ min: 0, max: 500 }),
        description: faker.commerce.productDescription(),
      },
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
    });
  }
  return products;
}

function generateSampleOrders(count = 20, maxUserId = 10, maxProductId = 10) {
  const orders = [];
  const statuses = ["pending", "completed", "shipped", "cancelled"];

  for (let i = 1; i <= count; i++) {
    const quantity = faker.number.int({ min: 1, max: 10 });
    const unitPrice = parseFloat(faker.commerce.price({ min: 10, max: 500, dec: 2 }));
    const totalPrice = parseFloat((quantity * unitPrice).toFixed(2));

    orders.push({
      table: "orders",
      data: {
        id: i,
        user_id: faker.number.int({ min: 1, max: maxUserId }),
        product_id: faker.number.int({ min: 1, max: maxProductId }),
        quantity: quantity,
        total_price: totalPrice,
        status: faker.helpers.arrayElement(statuses),
      },
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
    });
  }
  return orders;
}

// Send messages to Kafka
async function sendMessages(topic, messages) {
  try {
    const kafkaMessages = messages.map((msg) => ({
      key: `${msg.table}-${msg.data.id ?? msg.data.user_id ?? msg.data.product_id}`,
      value: JSON.stringify(msg),
      headers: {
        table: msg.table,
        messageId: msg.messageId,
        timestamp: msg.timestamp,
      },
    }));

    await producer.send({
      topic,
      messages: kafkaMessages,
    });

    logger.info(`Sent ${messages.length} messages to topic: ${topic}`);
    return { success: true, count: messages.length };
  } catch (error) {
    logger.error(`Failed to send messages to topic ${topic}`, { error: error.message });
    throw error;
  }
}

// Main producer function
async function main() {
  try {
    logger.info("🚀 Starting Kafka Producer...");

    // Get record counts from environment variables with defaults
    const usersCount = parseInt(process.env.PRODUCER_USERS_COUNT ?? "10", 10);
    const productsCount = parseInt(process.env.PRODUCER_PRODUCTS_COUNT ?? "10", 10);
    const ordersCount = parseInt(process.env.PRODUCER_ORDERS_COUNT ?? "20", 10);

    logger.info(`Configuration: Users=${usersCount}, Products=${productsCount}, Orders=${ordersCount}`);

    // Connect producer
    await producer.connect();
    logger.info("✅ Producer connected to Kafka");

    // Generate sample data using environment variables
    const users = generateSampleUsers(usersCount);
    const products = generateSampleProducts(productsCount);
    const orders = generateSampleOrders(ordersCount, usersCount, productsCount);

    // Send users
    await sendMessages(TOPICS.USERS, users);
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

    // Send products
    await sendMessages(TOPICS.PRODUCTS, products);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send orders
    await sendMessages(TOPICS.ORDERS, orders);

    logger.info("✅ All messages sent successfully!");

    // Keep producer alive for a bit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    logger.error("Producer error", { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await producer.disconnect();
    logger.info("Producer disconnected");
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  main().catch((error) => {
    logger.error("Fatal error", { error: error.message });
    process.exit(1);
  });
}

export { generateSampleUsers, generateSampleProducts, generateSampleOrders, sendMessages };
