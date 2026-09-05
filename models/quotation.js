import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js'; // Using db.js as seen in your app.js

export const Quotation = sequelize.define('Quotation', {
  quoteId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  siteAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  grandTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Firebase Storage URL for the PDF',
  },
}, {
  tableName: 'Quotations',
  timestamps: true,
});

export const Invoice = sequelize.define('Invoice', {
  invoiceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  siteAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
  customerGst: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  grandTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Firebase Storage URL for the Invoice PDF',
  },
}, {
  tableName: 'Invoices',
  timestamps: true,
});