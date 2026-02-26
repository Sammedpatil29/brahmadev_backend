import { User } from '../models/user.js';
import jwt from 'jsonwebtoken';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const user = await User.create({ name, email, phone, role, password });
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error.message);
    res.status(500).json({ error: 'Insert failed' });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const { id, fcm_token } = req.body;

    if (!id || !fcm_token) {
      return res.status(400).json({ error: 'ID and FCM token are required' });
    }

    // Sequelize syntax to update
    const [updatedRows] = await User.update(
      { fcm_token: fcm_token }, // Fields to update
      { where: { id: id } }      // Condition
    );

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error.message);
    res.status(500).json({ error: 'Update failed' });
  }
};

export const verifyToken = (req, res) => {
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
};

export const login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    const user = await User.findOne({ where: { phone, password } });
    if (!user) return res.status(401).json({ error: 'Invalid phone or password' });

    const payload = { id: user.id, phone: user.phone, username: user.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10d' });
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};