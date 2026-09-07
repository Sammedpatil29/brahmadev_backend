import express from 'express';
import { getAllUsers, createUser, updateUser, deleteUser, updateFcmToken, verifyToken, login } from '../controllers/userController.js';

const router = express.Router();

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/fcm-token', updateFcmToken);
router.post('/verify-token', verifyToken);
router.post('/login', login);

export default router;