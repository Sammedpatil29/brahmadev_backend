import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

export const Item = sequelize.define('Item', {
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  gst: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});