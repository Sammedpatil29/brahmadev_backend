import { transporter } from '../nodemailer.js';
import { User } from '../models/user.js';
import { fetchAccountAdSpend } from './metaAdsService.js';
import admin from '../firebase.js';
import { sequelize } from '../db.js';
import { Op } from 'sequelize';

/**
 * Meta Ads Automated Reporting Service
 * - Daily report sent every midnight (00:05 AM IST) for the previous day.
 * - Monthly GST spend report sent on the 1st of every month (00:15 AM IST) covering the entire previous month (1st to end).
 */

const SITE_REPORTS_URL = 'https://bc.democompany.in.net/layout/stats';

const FALLBACK_ADMIN_EMAILS = [
  'democompany2025@gmail.com',
  'sudarshan.b.patil108@gmail.com',
  'brahmadevaconstructions@gmail.com'
];

/**
 * Send push notification to admins via Firebase Cloud Messaging (FCM)
 */
export const sendMetaReportFCMNotification = async (title, body, reportType = 'META_DAILY_REPORT') => {
  try {
    const users = await User.findAll({
      where: {
        role: 'admin',
        [Op.and]: [sequelize.literal(`"fcm_token" IS NOT NULL AND "fcm_token" != ''`)]
      },
      attributes: ['fcm_token']
    });

    const tokens = users.map(u => u.fcm_token).filter(Boolean);
    if (tokens.length === 0) {
      console.log('[Meta Cron FCM] No registered admin FCM tokens found.');
      return;
    }

    const fcmMessage = {
      notification: {
        title,
        body
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high'
        }
      },
      data: {
        type: reportType,
        url: SITE_REPORTS_URL,
        timestamp: new Date().toISOString()
      },
      tokens
    };

    const fcmResponse = await admin.messaging().sendEachForMulticast(fcmMessage);
    console.log(`📱 [Meta Cron FCM] Notification Sent: ${fcmResponse.successCount} success, ${fcmResponse.failureCount} failed.`);
  } catch (fcmErr) {
    console.error('❌ [Meta Cron FCM] Failed to send push notification:', fcmErr.message);
  }
};

/**
 * Retrieve admin recipient email addresses
 */
export const getAdminEmails = async () => {
  try {
    const adminUsers = await User.findAll({
      where: { role: 'admin' },
      attributes: ['email']
    });
    const emails = adminUsers.map(u => u.email).filter(Boolean);
    if (emails.length > 0) {
      // Deduplicate with fallback
      return Array.from(new Set([...emails, ...FALLBACK_ADMIN_EMAILS]));
    }
  } catch (err) {
    console.error('[Meta Cron] Error querying admin emails from DB:', err.message);
  }
  return FALLBACK_ADMIN_EMAILS;
};

/**
 * Format currency in Indian format
 */
const formatINR = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
};

/**
 * Helper to get IST Date object
 */
const getISTDate = (date = new Date()) => {
  // Convert UTC to IST (+5:30)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
};

/**
 * Format Date as YYYY-MM-DD
 */
const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * -------------------------------------------------------------
 * 1. DAILY REPORT BUILDER & SENDER
 * -------------------------------------------------------------
 */
export const sendDailyMetaAdReport = async (overrideDateStr = null) => {
  try {
    const nowIST = getISTDate();
    
    // Default to yesterday IST
    let targetDateStr = overrideDateStr;
    if (!targetDateStr) {
      const yesterday = new Date(nowIST);
      yesterday.setDate(yesterday.getDate() - 1);
      targetDateStr = formatDateStr(yesterday);
    }

    console.log(`[Meta Cron] Generating Daily Meta Ads Report for ${targetDateStr}...`);

    const report = await fetchAccountAdSpend({
      since: targetDateStr,
      until: targetDateStr
    });

    if (!report || report.error || !report.configured) {
      console.warn(`[Meta Cron] Could not retrieve Meta Ads data for ${targetDateStr}:`, report?.errorMessage || 'Not configured');
    }

    const summary = report?.summary || {
      totalSpend: 0,
      gstAmount: 0,
      totalSpendWithGst: 0,
      totalLeads: 0,
      totalImpressions: 0,
      totalClicks: 0,
      costPerLead: 0,
      costPerLeadWithGst: 0,
      ctr: 0
    };

    const campaigns = report?.campaigns || [];
    const recipients = await getAdminEmails();

    const displayDate = new Date(targetDateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Build campaigns HTML table
    let campaignsHtml = '';
    if (campaigns.length > 0) {
      campaignsHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
              <th style="padding: 10px; border-top-left-radius: 6px;">Campaign</th>
              <th style="padding: 10px;">Spend</th>
              <th style="padding: 10px;">Leads</th>
              <th style="padding: 10px;">CPL (w/ GST)</th>
              <th style="padding: 10px; border-top-right-radius: 6px;">Clicks</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns.map((c, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: 600; color: #1e293b;">${c.campaignName}</td>
                <td style="padding: 10px; color: #0f172a;">₹${formatINR(c.spend)}<br/><span style="font-size: 11px; color: #64748b;">(₹${formatINR(c.spendWithGst)} incl. GST)</span></td>
                <td style="padding: 10px; font-weight: 700; color: ${c.leads > 0 ? '#16a34a' : '#64748b'};">${c.leads}</td>
                <td style="padding: 10px; color: #2563eb;">₹${formatINR(c.cplWithGst)}</td>
                <td style="padding: 10px; color: #475569;">${Number(c.clicks || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      campaignsHtml = `
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; color: #64748b; margin-top: 15px;">
          No active campaign spend recorded for this date.
        </div>
      `;
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 20px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0d6efd 0%, #1e40af 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">📊 Daily Meta Ads Report</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">${displayDate} &bull; Brahmadev Constructions</p>
        </div>

        <div style="padding: 24px;">
          <!-- Highlight KPI Cards -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Base Ad Spend</span>
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">₹${formatINR(summary.totalSpend)}</div>
              <span style="font-size: 11px; color: #2563eb; font-weight: 600;">+ ₹${formatINR(summary.gstAmount)} (18% GST)</span>
            </div>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #15803d; font-weight: 700;">Total Spend (With GST)</span>
              <div style="font-size: 20px; font-weight: 800; color: #166534; margin-top: 4px;">₹${formatINR(summary.totalSpendWithGst)}</div>
              <span style="font-size: 11px; color: #16a34a;">Gross Meta Expenditure</span>
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #1d4ed8; font-weight: 700;">Leads Acquired</span>
              <div style="font-size: 20px; font-weight: 800; color: #1e40af; margin-top: 4px;">${summary.totalLeads} Leads</div>
              <span style="font-size: 11px; color: #3b82f6;">Form & Messaging Enquiries</span>
            </div>

            <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #a16207; font-weight: 700;">Cost Per Lead (CPL)</span>
              <div style="font-size: 20px; font-weight: 800; color: #854d0e; margin-top: 4px;">₹${formatINR(summary.costPerLeadWithGst)}</div>
              <span style="font-size: 11px; color: #ca8a04;">(₹${formatINR(summary.costPerLead)} base CPL)</span>
            </div>
          </div>

          <!-- Secondary Metrics Strip -->
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; display: flex; justify-content: space-around; font-size: 12px; color: #334155; text-align: center;">
            <div><strong>Impressions:</strong> ${Number(summary.totalImpressions || 0).toLocaleString('en-IN')}</div>
            <div><strong>Clicks:</strong> ${Number(summary.totalClicks || 0).toLocaleString('en-IN')}</div>
            <div><strong>CTR:</strong> ${Number(summary.ctr || 0).toFixed(2)}%</div>
          </div>

          <!-- Campaign Breakdown Section -->
          <h4 style="margin: 0 0 6px 0; font-size: 15px; color: #0f172a;">Campaign Breakdown</h4>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Performance of tracked campaigns for ${displayDate}:</p>
          ${campaignsHtml}

          <!-- Footer Button -->
          <div style="text-align: center; margin-top: 26px;">
            <a href="${SITE_REPORTS_URL}" style="background-color: #0d6efd; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block;">
              View Live Dashboard on bc.democompany.in.net
            </a>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          Automated Daily Report &bull; Brahmadev Constructions Management System
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Brahmadev Meta Ads" <${process.env.EMAIL_USER}>`,
      to: recipients.join(','),
      subject: `📊 [Daily Meta Ads] ${displayDate} - Spend: ₹${formatINR(summary.totalSpendWithGst)} | Leads: ${summary.totalLeads}`,
      html: emailHtml
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Meta Cron] Daily Meta Ads report sent successfully to ${recipients.length} admins (Message ID: ${info.messageId})`);

    // Send FCM Push Notification with brief summary asking admins to check email
    const fcmTitle = `📊 Meta Ads Daily Report: ${displayDate}`;
    const fcmBody = `₹${formatINR(summary.totalSpendWithGst)} spend (incl. 18% GST) • ${summary.totalLeads} leads acquired (CPL: ₹${formatINR(summary.costPerLeadWithGst)}). Please check your email for the detailed breakdown.`;
    await sendMetaReportFCMNotification(fcmTitle, fcmBody, 'META_DAILY_REPORT');

    return { success: true, date: targetDateStr, recipients, summary };
  } catch (error) {
    console.error('❌ [Meta Cron] Failed to send daily Meta Ads report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * -------------------------------------------------------------
 * 2. MONTHLY GST REPORT BUILDER & SENDER (Runs on 1st of Month)
 * -------------------------------------------------------------
 */
export const sendMonthlyMetaGstReport = async (overrideYearMonth = null) => {
  try {
    const nowIST = getISTDate();

    let startStr, endStr, monthLabel;

    if (overrideYearMonth) {
      // format: 'YYYY-MM'
      const [y, m] = overrideYearMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      startStr = `${overrideYearMonth}-01`;
      endStr = `${overrideYearMonth}-${String(lastDay).padStart(2, '0')}`;
      monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } else {
      // The preceding month
      const prevMonthDate = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
      const y = prevMonthDate.getFullYear();
      const m = prevMonthDate.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      startStr = `${y}-${String(m).padStart(2, '0')}-01`;
      endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      monthLabel = prevMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }

    console.log(`[Meta Cron] Generating Monthly GST Spend Report for ${monthLabel} (${startStr} to ${endStr})...`);

    const report = await fetchAccountAdSpend({
      since: startStr,
      until: endStr
    });

    const summary = report?.summary || {
      totalSpend: 0,
      gstAmount: 0,
      totalSpendWithGst: 0,
      totalLeads: 0,
      totalImpressions: 0,
      totalClicks: 0,
      costPerLead: 0,
      costPerLeadWithGst: 0
    };

    const netSpend = summary.totalSpend;
    // Standard Indian GST Breakdown: 9% CGST + 9% SGST = 18% Total GST (or 18% IGST)
    const cgst = Math.round(netSpend * 0.09 * 100) / 100;
    const sgst = Math.round(netSpend * 0.09 * 100) / 100;
    const totalGst = summary.gstAmount;
    const grossSpend = summary.totalSpendWithGst;
    const campaigns = report?.campaigns || [];
    const recipients = await getAdminEmails();

    // Table of campaigns with detailed GST calculation
    let campaignsGstHtml = '';
    if (campaigns.length > 0) {
      campaignsGstHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <thead>
            <tr style="background-color: #1e293b; color: #ffffff; text-align: left;">
              <th style="padding: 10px; border-top-left-radius: 6px;">Campaign</th>
              <th style="padding: 10px;">Net Spend</th>
              <th style="padding: 10px;">18% GST</th>
              <th style="padding: 10px;">Gross Total</th>
              <th style="padding: 10px; border-top-right-radius: 6px;">Leads</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns.map((c, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: 600; color: #0f172a;">${c.campaignName}</td>
                <td style="padding: 10px; color: #334155;">₹${formatINR(c.spend)}</td>
                <td style="padding: 10px; color: #ea580c; font-weight: 600;">₹${formatINR(c.gstAmount)}</td>
                <td style="padding: 10px; font-weight: 700; color: #047857;">₹${formatINR(c.spendWithGst)}</td>
                <td style="padding: 10px; font-weight: 700; color: #2563eb;">${c.leads}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      campaignsGstHtml = `
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; color: #64748b; margin-top: 15px;">
          No campaigns recorded for this billing cycle.
        </div>
      `;
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 20px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 26px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">📑 Monthly Meta Ads GST & Spend Statement</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Period: ${monthLabel} (${startStr} to ${endStr})</p>
          <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px;">
            Brahmadev Constructions Accounting
          </div>
        </div>

        <div style="padding: 24px;">
          <!-- Accounting Summary Box -->
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Tax Invoice & GST Breakdown</h4>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #475569;">1. Net Meta Ad Spend (Taxable Value):</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">₹${formatINR(netSpend)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">2. CGST @ 9.0%:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #ea580c;">₹${formatINR(cgst)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">3. SGST @ 9.0%:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #ea580c;">₹${formatINR(sgst)}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 8px 0 6px 0; font-weight: 600; color: #334155;">Total GST Tax Paid (18%):</td>
                <td style="padding: 8px 0 6px 0; text-align: right; font-weight: 700; color: #ea580c;">₹${formatINR(totalGst)}</td>
              </tr>
              <tr style="border-top: 2px solid #0f172a;">
                <td style="padding: 10px 0 4px 0; font-weight: 800; font-size: 16px; color: #0f172a;">Gross Ad Expenditure:</td>
                <td style="padding: 10px 0 4px 0; text-align: right; font-weight: 800; font-size: 18px; color: #047857;">₹${formatINR(grossSpend)}</td>
              </tr>
            </table>
          </div>

          <!-- Monthly Performance Overview -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 22px;">
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: 700;">Total Leads</span>
              <div style="font-size: 18px; font-weight: 800; color: #1e3a8a; margin-top: 3px;">${summary.totalLeads}</div>
            </div>

            <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 12px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #854d0e; font-weight: 700;">Net CPL</span>
              <div style="font-size: 18px; font-weight: 800; color: #713f12; margin-top: 3px;">₹${formatINR(summary.costPerLead)}</div>
            </div>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #15803d; font-weight: 700;">CPL (w/ GST)</span>
              <div style="font-size: 18px; font-weight: 800; color: #14532d; margin-top: 3px;">₹${formatINR(summary.costPerLeadWithGst)}</div>
            </div>
          </div>

          <!-- Campaign Level GST Table -->
          <h4 style="margin: 0 0 6px 0; font-size: 15px; color: #0f172a;">Campaign GST Accounting Breakdown</h4>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Month-end figures for input tax credit and business expenditure records:</p>
          ${campaignsGstHtml}

          <!-- Footer Button -->
          <div style="text-align: center; margin-top: 26px;">
            <a href="${SITE_REPORTS_URL}" style="background-color: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block;">
              View Historical Stats Dashboard on bc.democompany.in.net
            </a>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          Monthly GST Statement &bull; Generated automatically on 1st of every month &bull; Brahmadev Constructions
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Brahmadev Accounts" <${process.env.EMAIL_USER}>`,
      to: recipients.join(','),
      subject: `📑 [Monthly Meta GST Report] ${monthLabel} - Total Spend: ₹${formatINR(grossSpend)} (GST: ₹${formatINR(totalGst)})`,
      html: emailHtml
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Meta Cron] Monthly GST report for ${monthLabel} sent successfully to ${recipients.length} admins (Message ID: ${info.messageId})`);

    // Send FCM Push Notification with brief summary asking admins to check email
    const fcmTitle = `📑 Monthly Meta Ads GST Statement: ${monthLabel}`;
    const fcmBody = `Total: ₹${formatINR(grossSpend)} (Base: ₹${formatINR(netSpend)} + 18% GST: ₹${formatINR(totalGst)}) • ${summary.totalLeads} leads. Full GST calculation and tax invoice sent to your email.`;
    await sendMetaReportFCMNotification(fcmTitle, fcmBody, 'META_MONTHLY_GST_REPORT');

    return { success: true, month: monthLabel, range: `${startStr} to ${endStr}`, recipients, summary };
  } catch (error) {
    console.error('❌ [Meta Cron] Failed to send monthly GST report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * -------------------------------------------------------------
 * 3. CRON SCHEDULER ENGINE (Node.js Timer - No external deps)
 * -------------------------------------------------------------
 * Checks once every minute against Asia/Kolkata (IST) time:
 * - At 00:05 AM IST every day: triggers sendDailyMetaAdReport()
 * - At 00:15 AM IST on Day 1 of each month: triggers sendMonthlyMetaGstReport()
 */
let cronIntervalId = null;
let lastDailyRunDate = null;
let lastMonthlyRunMonth = null;

export const initMetaReportCron = () => {
  if (cronIntervalId) {
    console.log('[Meta Cron] Scheduler already active.');
    return;
  }

  console.log('⏰ [Meta Cron] Initializing Meta Ads Reporting Scheduler (Timezone: Asia/Kolkata)...');
  console.log('   - Daily Report: Runs at 00:05 AM IST everyday');
  console.log('   - Monthly GST Report: Runs at 00:15 AM IST on the 1st of every month');

  // Check every 60 seconds
  cronIntervalId = setInterval(async () => {
    try {
      const nowIST = getISTDate();
      const hours = nowIST.getHours();
      const minutes = nowIST.getMinutes();
      const dateOfMonth = nowIST.getDate();
      const todayStr = formatDateStr(nowIST);
      const currentMonthKey = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}`;

      // 1. Daily Report Check: 00:05 AM IST
      if (hours === 0 && minutes >= 5 && minutes <= 10) {
        if (lastDailyRunDate !== todayStr) {
          lastDailyRunDate = todayStr;
          console.log(`[Meta Cron] Triggering Scheduled Midnight Daily Report for date: ${todayStr}...`);
          await sendDailyMetaAdReport();
        }
      }

      // 2. Monthly GST Report Check: Day 1 at 00:15 AM IST
      if (dateOfMonth === 1 && hours === 0 && minutes >= 15 && minutes <= 20) {
        if (lastMonthlyRunMonth !== currentMonthKey) {
          lastMonthlyRunMonth = currentMonthKey;
          console.log(`[Meta Cron] Triggering Scheduled 1st of Month GST Report for month: ${currentMonthKey}...`);
          await sendMonthlyMetaGstReport();
        }
      }
    } catch (err) {
      console.error('[Meta Cron] Scheduler tick error:', err);
    }
  }, 60 * 1000);
};

export const stopMetaReportCron = () => {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    console.log('[Meta Cron] Scheduler stopped.');
  }
};

