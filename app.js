import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from './db.js';
import { env } from 'process';
import userRoutes from './routes/userRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import itemRoutes from './routes/itemRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', // Allow all origins (for development)
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Sync models with database (creates table if not exists)
// sequelize.sync({ alter: true })
//   .then(() => console.log('✅ Database & tables synced'))
//   .catch(err => console.error('❌ Sync error:', err));

// ✅ Root route
app.get('/', (req, res) => {
  res.send('🚀 Express + Sequelize + Neon PostgreSQL API running!');
});

app.use('/', userRoutes);
app.use('/', siteRoutes);
app.use('/', leadRoutes);
app.use('/items', itemRoutes);

// Start server
sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.log(err));
