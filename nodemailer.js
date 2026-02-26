import nodemailer from 'nodemailer';
import dotenv from "dotenv";
dotenv.config();

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, // Try switching to 465 (SMTPS)
  secure: false, // Use true for 465
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