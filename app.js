import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from './db.js';
import userRoutes from './routes/userRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [];

app.use(cors(
//   {
//   origin: (origin, callback) => {
//     if (origin && allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
// }
       )
       );
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
app.use('/', quotationRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('✅ Database & tables synced');
  })
  .catch(err => {
    console.error('Failed to sync db:', err);
  });
