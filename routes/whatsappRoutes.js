// backend/routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    initialize,
    getStatus,
    getQRCode,
    sendMessage,
    sendPDF,
    sendImage,
    sendSalarySlip,
    logout,
    reconnect
} = require('../controllers/whatsappController');

// Public routes (no authentication required)
router.post('/init', initialize);
router.get('/status', getStatus);
router.get('/qr', getQRCode);
router.post('/reconnect', reconnect);

// Protected routes (require authentication)
router.post('/send', authMiddleware, sendMessage);
router.post('/send-text', authMiddleware, sendMessage);  // Alias for /send
router.post('/send-pdf', authMiddleware, sendPDF);
router.post('/send-image', authMiddleware, sendImage);
router.post('/send-salary-slip', authMiddleware, sendSalarySlip);
router.post('/logout', authMiddleware, logout);

module.exports = router;