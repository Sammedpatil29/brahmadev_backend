// models/SiteDetail.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';
import { User } from '../models/user.js';

export const SiteDetail = sequelize.define('SiteDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ownerContact: {
    type: DataTypes.STRING,
    allowNull: false
  },
  builtUpArea: {
    type: DataTypes.STRING,
    allowNull: true
  },
  floors: {
    type: DataTypes.STRING,
    allowNull: true
  },
  engineerName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  engineerContact: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractorName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractorContact: {
    type: DataTypes.STRING,
    allowNull: true
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  response: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'site_details',
  timestamps: true
});
