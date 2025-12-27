import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from './db.js';
import { User } from './models/user.js';
import { SiteDetail } from './models/siteDetails.js';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin
console.log("KEY:", process.env.FIREBASE_PRIVATE_KEY);
admin.initializeApp({
  credential: admin.credential.cert({
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  }),
  storageBucket: process.env.FIREBASE_BUCKET,
});

const bucket = admin.storage().bucket();

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
    let {
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

     const uploadedUrls = [];

    // Loop through each base64 DataURL
    for (const image of locationImage) {
      if (!image) continue;

      // Remove DataURL prefix
      const base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64EncodedImageString, 'base64');

      // Create unique file name
      const fileName = `uploads/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      const file = bucket.file(fileName);

      // Upload to Firebase Storage
      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
        public: true, // Make publicly accessible
        validation: 'md5',
      });

      // Construct public URL
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;

      uploadedUrls.push(publicUrl);
    }

    locationImage = uploadedUrls

    // Remove "data:image/jpeg;base64," from DataURL
    const base64EncodedImageString = selfie.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64EncodedImageString, 'base64');

    // Create unique file name
    const fileName = `uploads/selfie${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    // Upload to Firebase Storage
    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true, // makes file accessible via public URL
      validation: 'md5',
    });

    // Construct public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;
    selfie = publicUrl

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

app.get('/all-visits', async (req, res) => {
  // const { token } = req.body;

  // if (!token) {
  //   return res.status(400).json({ error: 'Token is required' });
  // }

  try {
    // Verify the token (throws if invalid)
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // You can now safely use decoded info (e.g., user id)
    // console.log('Decoded token:', decoded);

   const visits = await SiteDetail.findAll();

    // Example response
    return res.json({ visits });

  } catch (err) {
    console.error('Failed to retrive data', err.message);
    return res.status(401).json({ error: 'No data' });
  }
});

// POST /upload — handle dataURL from frontend
app.post('/upload', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Remove "data:image/jpeg;base64," from DataURL
    const base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64EncodedImageString, 'base64');

    // Create unique file name
    const fileName = `uploads/${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    // Upload to Firebase Storage
    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true, // makes file accessible via public URL
      validation: 'md5',
    });

    // Construct public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;

    console.log('✅ Image uploaded to Firebase:', publicUrl);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'your_custom_verify_token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry[0];
  const changes = entry.changes[0];
  
  if (changes.field === 'leadgen') {
    const leadId = changes.value.leadgen_id;
    // Call Meta Graph API to get full details
    const leadDetails = await fetchLeadDetails(leadId);
    
    // Save to your database and notify Ionic app (e.g., via Socket.io or Push)
    saveLeadToDb(leadDetails);
  }
  res.sendStatus(200); // Always respond 200 to acknowledge receipt
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
