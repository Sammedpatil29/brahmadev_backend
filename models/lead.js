import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

export const Lead = sequelize.define('Lead', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true, // Lead forms sometimes have missing non-required fields
  },
  time: {
    type: DataTypes.DATE, // Sequelize maps this to a TIMESTAMP in Postgres
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  response: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'new', // Default status for new leads
  },
  comment: {
  type: DataTypes.JSONB, // Optimized for JSON arrays and objects
  allowNull: true,
  defaultValue: []       // Initialize as an empty array
},
visit_schedule: {
  type: DataTypes.DATE, // or DataTypes.STRING depending on your preference
  allowNull: true
}
}, {
  tableName: 'meta_leads',
  timestamps: true, // Automatically adds createdAt and updatedAt
});