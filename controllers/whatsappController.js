// backend/controllers/whatsappController.js

const whatsappService = require('../services/whatsappService');
const QRCode = require('qrcode');

// Initialize WhatsApp
const initialize = async (req, res) => {
    try {
        await whatsappService.connectWhatsApp();
        res.json({
            success: true,
            message: 'WhatsApp initialization started. Check QR code endpoint.',
            status: whatsappService.getConnectionStatus()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get QR code as image (for browser scanning)
const getQRCode = async (req, res) => {
    try {
        const qrCode = whatsappService.getQR();
        
        if (!qrCode) {
            const status = whatsappService.getConnectionStatus();
            if (status.connected) {
                return res.json({
                    success: true,
                    connected: true,
                    message: 'WhatsApp is already connected!',
                    status: status.status
                });
            }
            return res.json({
                success: false,
                message: 'No QR code available. Please initialize WhatsApp first.',
                status: status.status
            });
        }
        
        // Generate QR code as base64 image
        const qrImage = await QRCode.toDataURL(qrCode);
        
        res.json({
            success: true,
            qrImage: qrImage,
            message: 'Scan this QR code with WhatsApp mobile app',
            instructions: [
                '1. Open WhatsApp on your phone',
                '2. Go to Settings → Linked Devices',
                '3. Tap "Link a Device"',
                '4. Scan this QR code'
            ]
        });
    } catch (error) {
        console.error('QR error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get status
const getStatus = async (req, res) => {
    res.json({
        success: true,
        ...whatsappService.getConnectionStatus()
    });
};

// Send text message
const sendMessage = async (req, res) => {
    try {
        const { to, text } = req.body;
        
        if (!to || !text) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and text are required'
            });
        }
        
        const result = await whatsappService.sendWhatsAppMessage(to, text);
        res.json({
            success: true,
            message: 'Message sent successfully',
            result
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Send PDF document
const sendPDF = async (req, res) => {
    try {
        const { to, caption, pdfBase64, pdfName } = req.body;
        
        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        if (!pdfBase64 || !pdfName) {
            return res.status(400).json({
                success: false,
                message: 'PDF data and file name are required'
            });
        }
        
        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        
        const result = await whatsappService.sendWhatsAppPDF(to, pdfBuffer, pdfName, caption || '');
        
        res.json({
            success: true,
            message: 'PDF sent successfully',
            result
        });
    } catch (error) {
        console.error('PDF send error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Send image
const sendImage = async (req, res) => {
    try {
        const { to, imageBase64, caption } = req.body;
        
        if (!to || !imageBase64) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and image are required'
            });
        }
        
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const result = await whatsappService.sendWhatsAppImage(to, imageBuffer, caption || '');
        
        res.json({
            success: true,
            message: 'Image sent successfully',
            result
        });
    } catch (error) {
        console.error('Image send error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Send salary slip
const sendSalarySlip = async (req, res) => {
    try {
        const { to, workerName, month, year, netSalary, companyName, pdfBase64, pdfName } = req.body;
        
        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        // Format the message
        const getMonthName = (month) => {
            const months = ["January", "February", "March", "April", "May", "June", 
                            "July", "August", "September", "October", "November", "December"];
            return months[month - 1];
        };
        
        const monthName = getMonthName(month);
        const formattedNetSalary = (netSalary || 0).toLocaleString('en-IN');
        
        const message = `*🏢 ${companyName || "Business Manager"}*
━━━━━━━━━━━━━━━━━━━━━━━

*💰 Salary Slip for ${monthName} ${year}*

👤 *Employee:* ${workerName}

━━━━━━━━━━━━━━━━━━━━━━━
*✨ Net Salary: ₹${formattedNetSalary}*
━━━━━━━━━━━━━━━━━━━━━━━

${pdfBase64 ? "📎 *Detailed salary slip attached as PDF*\n" : ""}
━━━━━━━━━━━━━━━━━━━━━━━
*This is an automated message from your HR system*`;
        
        // If PDF is provided, send as document
        if (pdfBase64 && pdfName) {
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');
            const result = await whatsappService.sendWhatsAppPDF(to, pdfBuffer, pdfName, message);
            res.json({
                success: true,
                message: 'Salary slip with PDF sent successfully',
                result
            });
        } else {
            // Send only text
            const result = await whatsappService.sendWhatsAppMessage(to, message);
            res.json({
                success: true,
                message: 'Salary slip text sent successfully',
                result
            });
        }
        
    } catch (error) {
        console.error('Salary slip send error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        await whatsappService.logoutWhatsApp();
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Reconnect
const reconnect = async (req, res) => {
    try {
        await whatsappService.reconnectWhatsApp();
        res.json({
            success: true,
            message: 'Reconnecting... Check QR code endpoint'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = { 
    initialize, 
    getStatus, 
    getQRCode, 
    sendMessage, 
    sendPDF,
    sendImage,
    sendSalarySlip,
    logout, 
    reconnect 
};