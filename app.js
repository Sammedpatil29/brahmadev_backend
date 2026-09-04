import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from './db.js';
import { initSocket } from './services/socketService.js';
import userRoutes from './routes/userRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import adSpendRoutes from './routes/adSpendRoutes.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
initSocket(server);

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
app.use('/', adSpendRoutes);

// Start server
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('✅ Database & tables synced');
  })
  .catch(err => {
    console.error('Failed to sync db:', err);
  });
