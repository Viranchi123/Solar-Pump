import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import colors from "colors";

dotenv.config();

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    dialectOptions: {
      connectTimeout: 10000, 
    },
    logging: false, 
  }
);

// Test the connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(colors.green("✅ MySQL Database Connected Successfully!"));
  } catch (error) {
    console.error(colors.red("❌ Error connecting to MySQL:"), error.message);
    process.exit(1);
  }
};

export { sequelize, connectDB };