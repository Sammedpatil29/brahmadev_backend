import express from 'express';
import { getAllUsers, createUser, updateFcmToken, verifyToken, login } from '../controllers/userController.js';

const router = express.Router();

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.patch('/users/fcm-token', updateFcmToken);
router.post('/verify-token', verifyToken);
router.post('/login', login);

export default router;