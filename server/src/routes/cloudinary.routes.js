import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as cloudinaryController from '../controllers/cloudinary.controller.js';

const router = express.Router();

router.use(authenticate);

// Generate secure upload signature
router.post('/sign', cloudinaryController.getUploadSignature);

// Safely delete a Cloudinary asset
router.delete('/asset', cloudinaryController.deleteAsset);

export default router;
