const { createClient } = require("@clickhouse/client");

// ClickHouse connection configuration
const client = createClient({
  url: "http://localhost:8123",
  database: "test",
  username: "admin",
  password: "admin123",
});

async function createDatabase() {
  console.log("📊 Creating database...\n");

  // Connect to default database to create the test database
  const defaultClient = createClient({
    url: "http://localhost:8123",
    database: "default",
    username: "admin",
    password: "admin123",
  });

  // Create database if it doesn't exist
  await defaultClient.command({
    query: "CREATE DATABASE IF NOT EXISTS test",
  });
  await defaultClient.close();
  console.log("✅ Created database 'test'\n");
}

async function createTables() {
  console.log("📊 Creating tables...\n");

  // Create users table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS users (
        id UInt64,
        name String,
        email String,
        age UInt8,
        city String,
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (id)
    `,
  });
  console.log("✅ Created users table");

  // Create products table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS products (
        id UInt64,
        name String,
        category String,
        price Decimal64(2),
        stock UInt32,
        description String,
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (id)
    `,
  });
  console.log("✅ Created products table");

  // Create orders table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS orders (
        id UInt64,
        user_id UInt64,
        product_id UInt64,
        quantity UInt32,
        total_price Decimal64(2),
        status String,
        order_date DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (id)
    `,
  });
  console.log("✅ Created orders table\n");
}

async function seedUsers() {
  console.log("👥 Seeding users data...");

  const users = [
    { id: 1, name: "John Doe", email: "john.doe@example.com", age: 30, city: "New York" },
    { id: 2, name: "Jane Smith", email: "jane.smith@example.com", age: 28, city: "Los Angeles" },
    { id: 3, name: "Bob Johnson", email: "bob.johnson@example.com", age: 35, city: "Chicago" },
    { id: 4, name: "Alice Williams", email: "alice.williams@example.com", age: 32, city: "Houston" },
    { id: 5, name: "Charlie Brown", email: "charlie.brown@example.com", age: 27, city: "Phoenix" },
    { id: 6, name: "Diana Prince", email: "diana.prince@example.com", age: 29, city: "Philadelphia" },
    { id: 7, name: "Eve Adams", email: "eve.adams@example.com", age: 31, city: "San Antonio" },
    { id: 8, name: "Frank Miller", email: "frank.miller@example.com", age: 33, city: "San Diego" },
    { id: 9, name: "Grace Lee", email: "grace.lee@example.com", age: 26, city: "Dallas" },
    { id: 10, name: "Henry Taylor", email: "henry.taylor@example.com", age: 34, city: "San Jose" },
  ];

  await client.insert({
    table: "users",
    values: users,
    format: "JSONEachRow",
  });

  console.log(`✅ Inserted ${users.length} users\n`);
}

async function seedProducts() {
  console.log("🛍️  Seeding products data...");

  const products = [
    {
      id: 1,
      name: "Laptop Pro 15",
      category: "Electronics",
      price: 1299.99,
      stock: 50,
      description: "High-performance laptop with 16GB RAM",
    },
    {
      id: 2,
      name: "Wireless Mouse",
      category: "Electronics",
      price: 29.99,
      stock: 200,
      description: "Ergonomic wireless mouse",
    },
    {
      id: 3,
      name: "Mechanical Keyboard",
      category: "Electronics",
      price: 149.99,
      stock: 75,
      description: "RGB mechanical keyboard",
    },
    {
      id: 4,
      name: "Office Chair",
      category: "Furniture",
      price: 299.99,
      stock: 30,
      description: "Ergonomic office chair",
    },
    {
      id: 5,
      name: "Standing Desk",
      category: "Furniture",
      price: 599.99,
      stock: 20,
      description: "Adjustable height standing desk",
    },
    {
      id: 6,
      name: 'Monitor 27"',
      category: "Electronics",
      price: 399.99,
      stock: 60,
      description: "4K Ultra HD monitor",
    },
    { id: 7, name: "Webcam HD", category: "Electronics", price: 79.99, stock: 100, description: "1080p HD webcam" },
    {
      id: 8,
      name: "Desk Lamp",
      category: "Furniture",
      price: 49.99,
      stock: 150,
      description: "LED desk lamp with dimmer",
    },
    {
      id: 9,
      name: "USB-C Hub",
      category: "Electronics",
      price: 59.99,
      stock: 120,
      description: "Multi-port USB-C hub",
    },
    {
      id: 10,
      name: "Noise Cancelling Headphones",
      category: "Electronics",
      price: 249.99,
      stock: 40,
      description: "Premium wireless headphones",
    },
  ];

  await client.insert({
    table: "products",
    values: products,
    format: "JSONEachRow",
  });

  console.log(`✅ Inserted ${products.length} products\n`);
}

async function seedOrders() {
  console.log("🛒 Seeding orders data...");

  const orders = [
    { id: 1, user_id: 1, product_id: 1, quantity: 1, total_price: 1299.99, status: "completed" },
    { id: 2, user_id: 1, product_id: 2, quantity: 2, total_price: 59.98, status: "completed" },
    { id: 3, user_id: 2, product_id: 3, quantity: 1, total_price: 149.99, status: "completed" },
    { id: 4, user_id: 2, product_id: 4, quantity: 1, total_price: 299.99, status: "pending" },
    { id: 5, user_id: 3, product_id: 5, quantity: 1, total_price: 599.99, status: "completed" },
    { id: 6, user_id: 3, product_id: 6, quantity: 2, total_price: 799.98, status: "shipped" },
    { id: 7, user_id: 4, product_id: 7, quantity: 1, total_price: 79.99, status: "completed" },
    { id: 8, user_id: 4, product_id: 8, quantity: 3, total_price: 149.97, status: "completed" },
    { id: 9, user_id: 5, product_id: 9, quantity: 1, total_price: 59.99, status: "pending" },
    { id: 10, user_id: 5, product_id: 10, quantity: 1, total_price: 249.99, status: "completed" },
    { id: 11, user_id: 6, product_id: 1, quantity: 1, total_price: 1299.99, status: "shipped" },
    { id: 12, user_id: 6, product_id: 3, quantity: 1, total_price: 149.99, status: "completed" },
    { id: 13, user_id: 7, product_id: 4, quantity: 2, total_price: 599.98, status: "pending" },
    { id: 14, user_id: 7, product_id: 6, quantity: 1, total_price: 399.99, status: "completed" },
    { id: 15, user_id: 8, product_id: 2, quantity: 5, total_price: 149.95, status: "completed" },
    { id: 16, user_id: 8, product_id: 7, quantity: 2, total_price: 159.98, status: "shipped" },
    { id: 17, user_id: 9, product_id: 8, quantity: 1, total_price: 49.99, status: "completed" },
    { id: 18, user_id: 9, product_id: 9, quantity: 2, total_price: 119.98, status: "completed" },
    { id: 19, user_id: 10, product_id: 10, quantity: 1, total_price: 249.99, status: "completed" },
    { id: 20, user_id: 10, product_id: 1, quantity: 1, total_price: 1299.99, status: "pending" },
  ];

  await client.insert({
    table: "orders",
    values: orders,
    format: "JSONEachRow",
  });

  console.log(`✅ Inserted ${orders.length} orders\n`);
}

async function verifyData() {
  console.log("🔍 Verifying data...\n");

  const userCount = await client.query({
    query: "SELECT count() as count FROM users",
    format: "JSONEachRow",
  });
  const users = await userCount.json();
  console.log(`📊 Users: ${users[0].count} records`);

  const productCount = await client.query({
    query: "SELECT count() as count FROM products",
    format: "JSONEachRow",
  });
  const products = await productCount.json();
  console.log(`📊 Products: ${products[0].count} records`);

  const orderCount = await client.query({
    query: "SELECT count() as count FROM orders",
    format: "JSONEachRow",
  });
  const orders = await orderCount.json();
  console.log(`📊 Orders: ${orders[0].count} records\n`);

  // Show sample data
  console.log("📋 Sample Users:");
  const sampleUsers = await client.query({
    query: "SELECT * FROM users LIMIT 3",
    format: "JSONEachRow",
  });
  const usersData = await sampleUsers.json();
  console.table(usersData);

  console.log("📋 Sample Products:");
  const sampleProducts = await client.query({
    query: "SELECT * FROM products LIMIT 3",
    format: "JSONEachRow",
  });
  const productsData = await sampleProducts.json();
  console.table(productsData);

  console.log("📋 Sample Orders:");
  const sampleOrders = await client.query({
    query: "SELECT * FROM orders LIMIT 3",
    format: "JSONEachRow",
  });
  const ordersData = await sampleOrders.json();
  console.table(ordersData);
}

async function main() {
  try {
    console.log("🚀 Starting ClickHouse seeding script...\n");
    console.log("🔌 Connecting to ClickHouse at http://localhost:8123\n");

    // Test connection
    await client.ping();
    console.log("✅ Connected to ClickHouse successfully!\n");

    // Create database
    await createDatabase();

    // Create tables
    await createTables();

    // Seed data
    await seedUsers();
    await seedProducts();
    await seedOrders();

    // Verify data
    await verifyData();

    console.log("✅ All done! Data seeded successfully.\n");
    console.log("💡 You can now query ClickHouse:");
    console.log("   - HTTP: http://localhost:8123");
    console.log("   - Native: localhost:9000");
    console.log("   - UI: http://localhost:8080 (Kafka UI)\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
main();
