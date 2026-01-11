import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from './db.js';
import { User } from './models/user.js';
import { SiteDetail } from './models/siteDetails.js';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import Op from 'sequelize'
import fs from 'fs';
import { env } from 'process';
import { Lead } from './models/lead.js';
import nodemailer from 'nodemailer';
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

  const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465, // Try switching to 465 (SMTPS)
  secure: true, // Use true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Adding a connection timeout limit so it doesn't hang forever
  connectionTimeout: 10000, 
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    // This is crucial for cloud environments to avoid handshake failures
    rejectUnauthorized: false,
    servername: 'smtp.gmail.com'
  }
});
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
    const payload = { id: user.id, phone: user.phone, username: user.name };
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

app.post('/meta-leads', async (req, res) => {
  try {
    const leadData = req.body;
    console.log('Received Lead:', leadData);

    // Save the lead directly
    const newLead = await Lead.create({
      name: leadData.name,
      contact: leadData.contact,
      city: leadData.city,
      time: leadData.time,
      platform: leadData.platform,
      response: 'new' // Ensuring it matches your frontend filter logic
    });

    // 2. Define your 3 users
    const adminEmails = ['democompany2025@gmail.com', 'sudarshan.b.patil108@gmail.com', 'brahmadevaconstructions@gmail.com'];

    const mailOptions = {
      from: `"Lead Manager" <${process.env.EMAIL_USER}>`,
      to: adminEmails.join(','), // Sends to all 3
      subject: `New Lead: ${leadData.name} from ${leadData.city}`,
      html: `
        <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #2e7d32;">New Lead Received!</h2>
          <p><strong>Name:</strong> ${leadData.name}</p>
          <p><strong>Contact:</strong> ${leadData.contact}</p>
          <p><strong>City:</strong> ${leadData.city}</p>
          <p><strong>Platform:</strong> ${leadData.platform}</p>
          <p><strong>Time:</strong> ${leadData.time}</p>
          <hr>
          <p>Please log in to the dashboard to follow up.</p>
        </div>
      `
    };

    // 3. Send the email (don't let email failure block the response)
    transporter.sendMail(mailOptions).catch(err => console.error('Mail Error:', err));

    // Respond quickly to Meta Webhook
    res.status(201).json({
      message: 'Lead saved and alerts sent',
      data: newLead
    });

  } catch (error) {
    console.error('Error saving Meta lead:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/leads', async (req, res) => {
  try {
    const leads = await Lead.findAll({
      // Sort by the 'time' field from Meta (or createdAt) in descending order
      order: [['time', 'DESC']], 
      // Optional: limit to the last 50 leads to keep the app fast
    });

    res.status(200).json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.patch('/leads/:id', async (req, res) => {
  const { id } = req.params;
  const { response, newComment, city, user, visit_schedule } = req.body;

  try {
    const lead = await Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // FIX 1: Use all lowercase strings in this array to match the .toLowerCase() check
    const statusesToClearDate = ['not interested', 'closed', 'new', 'wrong number'];
    
    // FIX 2: Initialize with the new value from the payload if it exists, otherwise keep current
    let updatedVisitSchedule = visit_schedule || lead.visit_schedule;
    
    // Clear date if response matches the clear list
    if (response && statusesToClearDate.includes(response.toLowerCase())) {
      updatedVisitSchedule = null;
    }

    // --- Rest of your logic ---
    let updatedComments = Array.isArray(lead.comment) ? [...lead.comment] : [];

    if (newComment && newComment.trim() !== "") {
      updatedComments.push({
        author: user || 'User',
        text: newComment,
        date: new Date()
      });
    } 

    const changes = [];
    if (visit_schedule) {
      const formattedDate = new Date(visit_schedule).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      changes.push(`Call scheduled for ${formattedDate}`);
    }

    if (changes.length > 0) {
      updatedComments.push({
        author: 'System',
        text: `Update: ${changes.join(', ')}`,
        date: new Date()
      });
    }

    await lead.update({
      response: response || lead.response, 
      city: city || lead.city,
      visit_schedule: updatedVisitSchedule, // This will now correctly be null or the date
      comment: updatedComments 
    });

    res.status(200).json(lead);
  } catch (error) {
    console.error('Patch Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET a single lead by ID
app.get('/leads/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const lead = await Lead.findByPk(id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.status(200).json(lead);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/leads/count/new', async (req, res) => {
    try {
        // filter for leads where status is exactly "new"
        // const count = await Lead.count({ response: 'new' });
        const count = await Lead.count({
      where: { response: 'new' }
    });
    const today = new Date().toISOString().split('T')[0]; 

        // 3. Simple Query: Match only the Date part of the visit_schedule column
        // const today = new Date().toISOString().split('T')[0]; 

const todayLeads = await Lead.findAll({
    where: sequelize.where(
        sequelize.fn('DATE', sequelize.col('visit_schedule')), 
        '<=', // This adds the "on or before" logic
        today
    ),
    attributes: { exclude: ['comment'] },
    // Order by date so the oldest missed visits appear at the top
    order: [
        ['visit_schedule', 'ASC']
    ]
});
        // Respond with the count in JSON format
        res.status(200).json({ 
            success: true, 
            count: count,
            todayCount: todayLeads.length,
            todayLeads: todayLeads,
            left: 3
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
