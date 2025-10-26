import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false, // disable console SQL logs
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }, // required for Neon
  },
});

// Test the connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL via Sequelize (Neon)');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
  }
})();
