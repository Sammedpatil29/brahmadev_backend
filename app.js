import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { sequelize } from './db.js';
import { User } from './models/user.js';
import { SiteDetail } from './models/siteDetails.js';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Sync models with database (creates table if not exists)
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Database & tables synced'))
  .catch(err => console.error('❌ Sync error:', err));

// ✅ Root route
app.get('/', (req, res) => {
  res.send('🚀 Express + Sequelize + Neon PostgreSQL API running!');
});

// ✅ Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ Create new user
app.post('/users', async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const user = await User.create({ name, email, phone, role, password });
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error.message);
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.post('/verify-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token missing' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ valid: true });
  } catch (error) {
    return res.json({ valid: false });
  }
});


app.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    // 🔹 Find user by phone and password
    const user = await User.findOne({
      where: {
        phone: phone,
        password: password
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // 🔹 Create JWT token
    const payload = { id: user.id, phone: user.phone, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10d' });

    res.json({ message: 'Login successful', token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/site-details', async (req, res) => {
    
  try {
    // Extract site data (everything except token)
    const {
        token,
      ownerName,
      ownerContact,
      builtUpArea,
      floors,
      engineerName,
      engineerContact,
      contractorName,
      contractorContact,
      comments,
      lat,
      lng,
      response,
      locationImage,
      selfie
    } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id

    // Validate required fields
    if (!ownerName || !ownerContact) {
      return res.status(400).json({ error: 'Owner name and contact are required' });
    }

    // Create a new site record linked to this user
    const site = await SiteDetail.create({
      ownerName,
      ownerContact,
      builtUpArea,
      floors,
      engineerName,
      engineerContact,
      contractorName,
      contractorContact,
      comments,
      lat,
      lng,
      response,
      userId,
      locationImage,
      selfie
    });

    res.status(201).json({
      message: '✅ Site details saved successfully',
    });
  } catch (error) {
    console.error('❌ Error saving site details:', error);
    res.status(500).json({ error: 'Failed to save site details' });
  }
}); 

app.post('/visits-by-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Verify the token (throws if invalid)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // You can now safely use decoded info (e.g., user id)
    console.log('Decoded token:', decoded);

   const user_visits = await SiteDetail.findAll({
    where: {
      userId: decoded.id
    }
   })

    // Example response
    return res.json({ user_visits });

  } catch (err) {
    console.error('Failed to retrive data', err.message);
    return res.status(401).json({ error: 'No data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
