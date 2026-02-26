import { SiteDetail } from '../models/siteDetails.js';
import jwt from 'jsonwebtoken';
import { bucket } from '../firebase.js';

export const createSiteDetails = async (req, res) => {
  try {
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
    const userId = decoded.id;

    if (!ownerName || !ownerContact) {
      return res.status(400).json({ error: 'Owner name and contact are required' });
    }

    const uploadedUrls = [];
    for (const image of locationImage) {
      if (!image) continue;
      const base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64EncodedImageString, 'base64');
      const fileName = `uploads/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
        public: true,
        validation: 'md5',
      });
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;
      uploadedUrls.push(publicUrl);
    }
    locationImage = uploadedUrls;

    const base64EncodedImageString = selfie.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64EncodedImageString, 'base64');
    const fileName = `uploads/selfie${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
      validation: 'md5',
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;
    selfie = publicUrl;

    await SiteDetail.create({
      ownerName, ownerContact, builtUpArea, floors, engineerName, engineerContact,
      contractorName, contractorContact, comments, lat, lng, response, userId,
      locationImage, selfie
    });

    res.status(201).json({ message: '✅ Site details saved successfully' });
  } catch (error) {
    console.error('❌ Error saving site details:', error);
    res.status(500).json({ error: 'Failed to save site details' });
  }
};

export const getVisitsByToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    const user_visits = await SiteDetail.findAll({ where: { userId: decoded.id } });
    return res.json({ user_visits });
  } catch (err) {
    console.error('Failed to retrive data', err.message);
    return res.status(401).json({ error: 'No data' });
  }
};

export const getAllVisits = async (req, res) => {
  try {
    const visits = await SiteDetail.findAll();
    return res.json({ visits });
  } catch (err) {
    console.error('Failed to retrive data', err.message);
    return res.status(401).json({ error: 'No data' });
  }
};

export const uploadImage = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image data provided' });

    const base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64EncodedImageString, 'base64');
    const fileName = `uploads/${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
      validation: 'md5',
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;
    console.log('✅ Image uploaded to Firebase:', publicUrl);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};