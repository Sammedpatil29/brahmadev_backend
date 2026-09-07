import { User } from '../models/user.js';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, phone, role = 'user', password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }

    // Check if email or phone already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }]
      }
    });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Phone number';
      return res.status(400).json({ error: `${field} is already registered with another user` });
    }

    const user = await User.create({ name, email, phone, role, password });
    const userSafe = user.toJSON();
    delete userSafe.password;
    res.status(201).json(userSafe);
  } catch (error) {
    console.error('Error creating user:', error.message);
    res.status(500).json({ error: 'Failed to create user: ' + error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, password } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check duplicate email or phone for other users
    if (email || phone) {
      const conflict = await User.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.or]: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : [])
          ]
        }
      });
      if (conflict) {
        const field = conflict.email === email ? 'Email' : 'Phone number';
        return res.status(400).json({ error: `${field} is already in use by another user` });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (password && password.trim() !== '') {
      updateData.password = password.trim();
    }

    await user.update(updateData);
    const userSafe = user.toJSON();
    delete userSafe.password;
    res.json(userSafe);
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ error: 'Failed to update user: ' + error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    res.json({ message: 'User deleted successfully', id });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).json({ error: 'Failed to delete user: ' + error.message });
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

export const verifyToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'name', 'email', 'phone', 'role']
    });
    return res.json({ valid: true, user: user ? user.toJSON() : null });
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

    const payload = { id: user.id, phone: user.phone, username: user.name, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10d' });
    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};