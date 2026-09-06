import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from './db.js';
import { initSocket } from './services/socketService.js';
import userRoutes from './routes/userRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import adSpendRoutes from './routes/adSpendRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ✅ OTA Updates static route (serves manifests and update bundles)
app.use('/ota', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.path.endsWith('.json')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
}, express.static(path.join(__dirname, 'public', 'ota')));

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

// ✅ Resilient database synchronization with safe column checks
(async () => {
  try {
    // 1. Initial base sync (creates missing tables like Invoices without destructive alters)
    await sequelize.sync();
    console.log('✅ Base tables verified / created');

    // 2. Safe idempotent column additions for PostgreSQL (Neon)
    // Prevents errors when adding new fields to existing tables
    await sequelize.query(`
      DO $$ 
      BEGIN 
        -- Ensure email column exists on Quotations table
        IF EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND (table_name = 'Quotations' OR table_name = 'quotations')
        ) THEN
          IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (table_name = 'Quotations' OR table_name = 'quotations') 
            AND column_name = 'email'
          ) THEN
            ALTER TABLE "Quotations" ADD COLUMN "email" VARCHAR(255);
          END IF;
        END IF;

        -- Ensure email column exists on Invoices table
        IF EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND (table_name = 'Invoices' OR table_name = 'invoices')
        ) THEN
          IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (table_name = 'Invoices' OR table_name = 'invoices') 
            AND column_name = 'email'
          ) THEN
            ALTER TABLE "Invoices" ADD COLUMN "email" VARCHAR(255);
          END IF;
        END IF;
      END $$;
    `);

    // 3. Run sync with alter: true inside try-catch to absorb non-fatal constraint notices
    try {
      await sequelize.sync({ alter: true });
      console.log('✅ Database & tables synced with alter: true');
    } catch (alterErr) {
      console.warn('⚠️ sequelize.sync({ alter: true }) notice (non-fatal, schema verified):', alterErr.message);
    }

  } catch (err) {
    console.error('❌ Failed to sync db:', err.message);
  }
})();
