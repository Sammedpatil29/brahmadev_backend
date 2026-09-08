import { Lead } from '../models/lead.js';
import { User } from '../models/user.js';
import { sequelize } from '../db.js';
import { Op } from 'sequelize';
import { transporter } from '../nodemailer.js';
import admin from '../firebase.js';
import jwt from 'jsonwebtoken';
import { emitNewLead } from '../services/socketService.js';

export const createMetaLead = async (req, res) => {
  try {
    const leadData = req.body;
    console.log('Received Lead:', leadData);

    const newLead = await Lead.create({
      name: leadData.name,
      contact: leadData.contact,
      city: leadData.city,
      time: leadData.time,
      platform: leadData.platform,
      response: 'new'
    });

    // Broadcast new lead via Socket.IO in real-time
    try {
      emitNewLead(newLead.toJSON ? newLead.toJSON() : newLead);
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
    }

    const adminEmails = ['democompany2025@gmail.com', 'sudarshan.b.patil108@gmail.com', 'brahmadevaconstructions@gmail.com'];
    const mailOptions = {
      from: `"Lead Manager" <${process.env.EMAIL_USER}>`,
      to: adminEmails.join(','),
      subject: `🔥New Lead alert`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  <div style="background-color: #2e7d32; padding: 20px; text-align: center;">
    <h2 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 0.5px;">🚀 New Lead Received!</h2>
  </div>

  <div style="padding: 24px; background-color: #ffffff;">
    <div style="margin-bottom: 15px;">
      <span style="font-weight: 600; color: #555; width: 100px; display: inline-block;">👤 Name:</span>
      <span style="color: #1a1a1a; font-size: 16px;">${leadData.name}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <span style="font-weight: 600; color: #555; width: 100px; display: inline-block;">📞 Contact:</span>
      <a href="tel:${leadData.contact}" style="color: #2e7d32; font-size: 16px; font-weight: 600; text-decoration: none;">${leadData.contact}</a>
    </div>

    <div style="margin-bottom: 15px;">
      <span style="font-weight: 600; color: #555; width: 100px; display: inline-block;">📍 City:</span>
      <span style="color: #1a1a1a; font-size: 16px;">${leadData.city}</span>
    </div>

    <div style="margin-bottom: 15px;">
      <span style="font-weight: 600; color: #555; width: 100px; display: inline-block;">📱 Platform:</span>
      <span style="background-color: #f0f4f0; color: #2e7d32; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">${leadData.platform}</span>
    </div>

    <div style="margin-bottom: 25px;">
      <span style="font-weight: 600; color: #555; width: 100px; display: inline-block;">⏰ Time:</span>
      <span style="color: #757575; font-size: 14px;">${leadData.time}</span>
    </div>

    <div style="text-align: center; margin-bottom: 10px;">
      <a href="tel:${leadData.contact}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        📞 Call Lead Now
      </a>
    </div>

    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

    <p style="color: #666; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
      Please log in to the <strong>Admin Dashboard</strong> to update the status of this lead.
    </p>
  </div>
  
  <div style="background-color: #fafafa; padding: 15px; text-align: center; border-top: 1px solid #eee;">
    <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Brahmadev Constructions Internal</span>
  </div>
</div>
      `
    };

    transporter.sendMail(mailOptions).catch(err => console.error('Mail Error:', err));

    try {
      const users = await User.findAll({
        where: {
          role: 'admin',
          [Op.and]: [sequelize.literal(`"fcm_token" IS NOT NULL AND "fcm_token" != ''`)]
        },
        attributes: ['fcm_token']
      });

      const tokens = users.map(u => u.fcm_token);
      if (tokens.length > 0) {
        const fcmMessage = {
          notification: {
            title: '🔥 New Lead Alert!',
            body: `${leadData.name} from ${leadData.city} just Enquired!.`
          },
          android: { notification: { sound: 'default', priority: 'high' } },
          data: { leadId: String(newLead.id), type: 'NEW_LEAD' },
          tokens: tokens
        };
        const fcmResponse = await admin.messaging().sendEachForMulticast(fcmMessage);
        console.log(`✅ FCM Broadcast Sent: ${fcmResponse.successCount} success, ${fcmResponse.failureCount} failed.`);
      }
    } catch (fcmErr) {
      console.error('❌ FCM Broadcast Failed:', fcmErr.message);
    }

    res.status(201).json({ message: 'Lead saved and alerts sent', data: newLead });
  } catch (error) {
    console.error('Error saving Meta lead:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const sendCustomFcm = async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and Body are required.' });

    const users = await User.findAll({
      where: sequelize.literal(`"fcm_token" IS NOT NULL AND "fcm_token" != ''`),
      attributes: ['fcm_token']
    });

    const allTokens = users.map(u => u.fcm_token);
    if (allTokens.length === 0) return res.status(404).json({ success: false, message: 'No users found with valid FCM tokens.' });

    const batchSize = 500;
    const batches = [];
    for (let i = 0; i < allTokens.length; i += batchSize) {
      const batchTokens = allTokens.slice(i, i + batchSize);
      const message = {
        notification: { title, body },
        android: { notification: { sound: 'default', priority: 'high' } },
        data: { leadId: Math.random().toString(36).substring(7), type: 'Custom FCM' },
        tokens: batchTokens
      };
      batches.push(admin.messaging().sendEachForMulticast(message));
    }

    const results = await Promise.all(batches);
    let successCount = 0;
    let failureCount = 0;
    results.forEach(batchResponse => {
      successCount += batchResponse.successCount;
      failureCount += batchResponse.failureCount;
    });

    console.log(`✅ FCM Broadcast Sent: ${successCount} success, ${failureCount} failed.`);
    return res.json({
      success: true,
      message: 'Notifications sent successfully',
      stats: { total_tokens: allTokens.length, success: successCount, failed: failureCount }
    });
  } catch (fcmErr) {
    console.error('❌ FCM Broadcast Failed:', fcmErr);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: fcmErr.message });
  }
};

export const getLeads = async (req, res) => {
  console.log('leads called');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    let where = {};
    if (user.role !== 'admin') {
      where.access = { [Op.contains]: [user.id] };
    }

    const leads = await Lead.findAll({ where, order: [['time', 'DESC']] });
    res.status(200).json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const updateLead = async (req, res) => {
  const { id } = req.params;
  const { response, newComment, city, user, visit_schedule, access } = req.body;

  try {
    const lead = await Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const statusesToClearDate = ['not interested', 'closed', 'new', 'wrong number'];
    let updatedVisitSchedule = visit_schedule || lead.visit_schedule;
    if (response && statusesToClearDate.includes(response.toLowerCase())) {
      updatedVisitSchedule = null;
    }

    let updatedComments = Array.isArray(lead.comment) ? [...lead.comment] : [];
    if (newComment && newComment.trim() !== "") {
      updatedComments.push({ author: user || 'User', text: newComment, date: new Date() });
    }

    const changes = [];
    if (visit_schedule) {
      const formattedDate = new Date(visit_schedule).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      changes.push(`Call scheduled for ${formattedDate}`);
    }
    if (changes.length > 0) {
      updatedComments.push({ author: 'System', text: `Update: ${changes.join(', ')}`, date: new Date() });
    }

    let updatedAccess = lead.access || [];
    if (access !== undefined && Array.isArray(access)) {
      updatedAccess = access;
    } else if (access) {
      const val = Number(access);
      if (!isNaN(val)) updatedAccess = [val];
    }

    await lead.update({
      response: response || lead.response,
      city: city || lead.city,
      visit_schedule: updatedVisitSchedule,
      comment: updatedComments,
      access: updatedAccess,
    });

    if (access && updatedAccess.length > 0) {
      try {
        const users = await User.findAll({
          where: { id: { [Op.in]: updatedAccess }, [Op.and]: [sequelize.literal(`"fcm_token" IS NOT NULL AND "fcm_token" != ''`)] },
          attributes: ['fcm_token']
        });
        const tokens = users.map(u => u.fcm_token);
        if (tokens.length > 0) {
          const message = {
            notification: { title: '🔥New Lead Access Granted', body: `You have been assigned to lead: ${lead.name}` },
            android: { notification: { sound: 'default', priority: 'high' } },
            data: { leadId: String(lead.id), type: 'LEAD_ACCESS' },
            tokens: tokens
          };
          await admin.messaging().sendEachForMulticast(message);
        }
      } catch (err) {
        console.error('Error sending access notification:', err);
      }
    }

    const userList = await User.findAll({ where: { role: 'user' }, attributes: ['id', 'name'] });
    const responseData = lead.toJSON();
    responseData.userList = userList;
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Patch Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLeadById = async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const userList = await User.findAll({ where: { role: 'user' }, attributes: ['id', 'name'] });
    const status = ['Interested', 'Not Interested','Quotation Requested', 'Yet To Think', 'Call back Requested', 'Busy', 'Long Distance', 'Follow Up', 'Visit Confirmed', 'Visiting Soon', 'Wrong Number', 'Quotation Sent', 'Closed', 'new', 'Engineer', 'Mestri', 'Contractor', 'visit done', 'order completed'];
    res.status(200).json({ ...lead.toJSON(), access: lead.access || [], status, userList });
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNewLeadsCount = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    let accessCondition = {};
    if (user.role !== 'admin') {
      accessCondition = { access: { [Op.contains]: [user.id] } };
    }

    const count = await Lead.count({ where: { response: 'new', ...accessCondition } });
    const today = new Date().toISOString().split('T')[0];
    const todayLeads = await Lead.findAll({
      where: {
        ...accessCondition,
        [Op.and]: [sequelize.where(sequelize.fn('DATE', sequelize.col('visit_schedule')), '<=', today)]
      },
      attributes: { exclude: ['comment'] },
      order: [['visit_schedule', 'ASC']]
    });

    res.status(200).json({ success: true, count: count, todayCount: todayLeads.length, todayLeads: todayLeads, left: 14 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};