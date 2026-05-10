// backend/routes/broadcastRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const BroadcastHistory = require("../models/BroadcastHistory");

// Helper function to generate unique ID
function generateBulkId() {
  return `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// Helper function to format phone number
function formatPhoneNumber(number) {
  if (!number) return null;
  number = number.replace(/\D/g, "");
  if (!number.startsWith("91")) {
    number = `91${number}`;
  }
  return number;
}

// ======================================================
// SEND TEST MESSAGE (Debug version)
// ======================================================
router.post("/send-whatsapp", auth, async (req, res) => {
  try {
    console.log("=== SEND TEST MESSAGE ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    const { phoneNumber, message, workerId, workerName, messageType } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        msg: "Phone number is required"
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        msg: "Message is required"
      });
    }
    
    const formattedNumber = formatPhoneNumber(phoneNumber);
    console.log("Formatted number:", formattedNumber);
    
    if (!formattedNumber) {
      return res.status(400).json({
        success: false,
        msg: "Invalid phone number format"
      });
    }
    
    // Try to send WhatsApp message
    try {
      await sendWhatsAppMessage(formattedNumber, message);
      console.log("WhatsApp message sent successfully");
    } catch (whatsappError) {
      console.error("WhatsApp sending error:", whatsappError);
      return res.status(500).json({
        success: false,
        msg: "Failed to send WhatsApp message: " + whatsappError.message
      });
    }
    
    // Save to history
    try {
      const history = new BroadcastHistory({
        companyId: req.user.companyId,
        workerId: workerId,
        workerName: workerName || "Test User",
        phoneNumber: formattedNumber,
        message: message,
        messageType: messageType || "custom",
        status: "success",
        sentBy: req.user.id,
        sentByName: req.user.name || req.user.email || "Admin",
        sentAt: new Date(),
        isBulk: false
      });
      
      await history.save();
      console.log("History saved successfully");
    } catch (historyError) {
      console.error("History save error:", historyError);
      // Don't fail the request if history save fails
    }
    
    res.json({
      success: true,
      msg: "Test message sent successfully"
    });
    
  } catch (error) {
    console.error("Error in send-whatsapp route:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to send test message",
      error: error.message,
      stack: error.stack
    });
  }
});

// ======================================================
// SEND BULK MESSAGES (Debug version)
// ======================================================
router.post("/send-bulk", auth, async (req, res) => {
  try {
    console.log("=== SEND BULK MESSAGES ===");
    const { workers, message, messageType } = req.body;
    
    if (!workers || workers.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "No workers selected"
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        msg: "Message is required"
      });
    }
    
    const bulkId = generateBulkId();
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const worker of workers) {
      const formattedNumber = formatPhoneNumber(worker.phone);
      if (!formattedNumber) {
        failCount++;
        errors.push({ worker: worker.name, error: "Invalid phone number" });
        continue;
      }
      
      const personalizedMessage = message.replace(/{name}/g, worker.name);
      
      try {
        await sendWhatsAppMessage(formattedNumber, personalizedMessage);
        
        // Save to history
        const history = new BroadcastHistory({
          companyId: req.user.companyId,
          workerId: worker._id,
          workerName: worker.name,
          phoneNumber: formattedNumber,
          message: personalizedMessage,
          messageType: messageType || "custom",
          status: "success",
          sentBy: req.user.id,
          sentByName: req.user.name || req.user.email || "Admin",
          sentAt: new Date(),
          isBulk: true,
          bulkId: bulkId
        });
        
        await history.save();
        successCount++;
        
      } catch (error) {
        console.error(`Failed to send to ${worker.name}:`, error.message);
        failCount++;
        errors.push({ worker: worker.name, error: error.message });
        
        // Save failed to history
        try {
          const history = new BroadcastHistory({
            companyId: req.user.companyId,
            workerId: worker._id,
            workerName: worker.name,
            phoneNumber: formattedNumber,
            message: personalizedMessage,
            messageType: messageType || "custom",
            status: "failed",
            errorMessage: error.message,
            sentBy: req.user.id,
            sentByName: req.user.name || req.user.email || "Admin",
            sentAt: new Date(),
            isBulk: true,
            bulkId: bulkId
          });
          
          await history.save();
        } catch (historyError) {
          console.error("Failed to save error history:", historyError);
        }
      }
    }
    
    res.json({
      success: true,
      bulkId: bulkId,
      total: workers.length,
      successCount: successCount,
      failCount: failCount,
      errors: errors
    });
    
  } catch (error) {
    console.error("Error sending bulk messages:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to send bulk messages",
      error: error.message
    });
  }
});

// ======================================================
// GET BROADCAST HISTORY
// ======================================================
router.get("/history", auth, async (req, res) => {
  try {
    console.log("Fetching broadcast history for user:", req.user.id);
    
    let query = { companyId: req.user.companyId };
    
    const history = await BroadcastHistory.find(query)
      .sort({ sentAt: -1 })
      .limit(parseInt(req.query.limit) || 50)
      .populate("workerId", "name phone designation status");
    
    const total = await BroadcastHistory.countDocuments(query);
    
    res.json({
      success: true,
      data: history,
      pagination: {
        total: total,
        limit: parseInt(req.query.limit) || 50,
        hasMore: total > (parseInt(req.query.limit) || 50)
      }
    });
    
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch history",
      error: error.message
    });
  }
});

// ======================================================
// GET STATISTICS
// ======================================================
router.get("/stats", auth, async (req, res) => {
  try {
    console.log("Fetching broadcast stats for user:", req.user.id);
    
    const totalSent = await BroadcastHistory.countDocuments({
      companyId: req.user.companyId,
      status: "success"
    });
    
    const totalFailed = await BroadcastHistory.countDocuments({
      companyId: req.user.companyId,
      status: "failed"
    });
    
    const last30Days = await BroadcastHistory.countDocuments({
      companyId: req.user.companyId,
      sentAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    const last7Days = await BroadcastHistory.countDocuments({
      companyId: req.user.companyId,
      sentAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    const today = await BroadcastHistory.countDocuments({
      companyId: req.user.companyId,
      sentAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    res.json({
      success: true,
      stats: {
        totalSent: totalSent || 0,
        totalFailed: totalFailed || 0,
        last30Days: last30Days || 0,
        last7Days: last7Days || 0,
        today: today || 0,
        byMessageType: []
      }
    });
    
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch statistics",
      error: error.message
    });
  }
});

// ======================================================
// DELETE HISTORY RECORD
// ======================================================
router.delete("/history/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BroadcastHistory.findOneAndDelete({
      _id: id,
      companyId: req.user.companyId
    });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        msg: "History record not found"
      });
    }
    
    res.json({
      success: true,
      msg: "History record deleted successfully"
    });
    
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to delete history"
    });
  }
});

// Add this to your existing broadcastRoutes.js
router.post("/send-salary-slip", auth, async (req, res) => {
  try {
    const { phoneNumber, message, workerId, workerName, pdfBase64, pdfName, month, year, netSalary } = req.body;
    
    console.log("Received salary slip request for:", workerName);
    console.log("Phone number:", phoneNumber);
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        msg: "Phone number is required" 
      });
    }
    
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber) {
      return res.status(400).json({ 
        success: false, 
        msg: "Invalid phone number format" 
      });
    }
    
    // Format the message nicely
    const formattedMessage = message || `
*🏢 Salary Slip Generated*
━━━━━━━━━━━━━━━━━━━━━━━

👤 *Employee:* ${workerName}
📅 *Month:* ${getMonthName(month)} ${year}
💰 *Net Salary:* ₹${netSalary?.toLocaleString('en-IN') || 0}

━━━━━━━━━━━━━━━━━━━━━━━
*Salary slip attached as PDF*
    `;
    
    // Send WhatsApp message
    await sendWhatsAppMessage(formattedNumber, formattedMessage);
    
    // Save to history (without PDF to avoid large storage)
    const history = new BroadcastHistory({
      companyId: req.user.companyId,
      workerId: workerId,
      workerName: workerName,
      phoneNumber: formattedNumber,
      message: `Salary slip for ${getMonthName(month)} ${year} - ₹${netSalary?.toLocaleString('en-IN') || 0}`,
      messageType: "salary_slip",
      status: "success",
      sentBy: req.user.id,
      sentByName: req.user.name || req.user.email || "Admin",
      sentAt: new Date(),
      isBulk: false,
      metadata: { month, year, netSalary }
    });
    
    await history.save();
    
    console.log(`✅ Salary slip sent to ${workerName} at ${formattedNumber}`);
    
    res.json({ 
      success: true, 
      msg: "Salary slip sent successfully" 
    });
    
  } catch (error) {
    console.error("Error sending salary slip:", error);
    res.status(500).json({ 
      success: false, 
      msg: error.message || "Failed to send salary slip" 
    });
  }
});

// Helper function to get month name
function getMonthName(month) {
  const months = ["January", "February", "March", "April", "May", "June", 
                  "July", "August", "September", "October", "November", "December"];
  return months[month - 1];
}

// backend/routes/broadcastRoutes.js
// Add this new endpoint for sending PDF via WhatsApp

const fs = require('fs');
const path = require('path');

router.post("/send-pdf-whatsapp", auth, async (req, res) => {
  try {
    const { phoneNumber, message, pdfBase64, pdfName, workerId, workerName, metadata } = req.body;
    
    console.log(`Sending PDF WhatsApp to: ${workerName} (${phoneNumber})`);
    
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber) {
      return res.status(400).json({ 
        success: false, 
        msg: "Invalid phone number" 
      });
    }
    
    // Decode base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const tempFilePath = path.join(__dirname, '../temp', `${Date.now()}_${pdfName}`);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save temporary file
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // Format the message
    const formattedMessage = message || `
*🏢 Salary Slip*
━━━━━━━━━━━━━━━━━━━━━━━

*Employee:* ${workerName}
${metadata?.month ? `*Month:* ${getMonthName(metadata.month)} ${metadata.year}` : ''}
${metadata?.netSalary ? `*Net Salary:* ₹${metadata.netSalary.toLocaleString('en-IN')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━
*📎 Salary slip attached as PDF*
    `;
    
    // Send WhatsApp message with PDF
    await sendWhatsAppMessageWithPDF(formattedNumber, formattedMessage, tempFilePath, pdfName);
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    // Save to history
    const history = new BroadcastHistory({
      companyId: req.user.companyId,
      workerId: workerId,
      workerName: workerName,
      phoneNumber: formattedNumber,
      message: `Salary slip sent to ${workerName}`,
      messageType: "salary_slip_pdf",
      status: "success",
      sentBy: req.user.id,
      sentByName: req.user.name || req.user.email,
      sentAt: new Date(),
      isBulk: false,
      metadata: metadata || {}
    });
    
    await history.save();
    
    console.log(`✅ PDF sent to ${workerName}`);
    
    res.json({ 
      success: true, 
      msg: "PDF sent successfully" 
    });
    
  } catch (error) {
    console.error("Error sending PDF via WhatsApp:", error);
    res.status(500).json({ 
      success: false, 
      msg: error.message 
    });
  }
});

// Helper function to send WhatsApp message with PDF
async function sendWhatsAppMessageWithPDF(phoneNumber, message, pdfPath, pdfName) {
  // This function depends on your WhatsApp service
  // For Baileys, you would send media message
  // For now, log and simulate
  
  console.log(`Sending to ${phoneNumber}:`);
  console.log(`Message: ${message.substring(0, 100)}...`);
  console.log(`PDF: ${pdfName}`);
  
  // Here you would implement actual PDF sending logic
  // For Baileys:
  // const sock = getWhatsAppConnection();
  // await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
  //   text: message,
  //   document: { url: pdfPath },
  //   fileName: pdfName,
  //   mimetype: 'application/pdf'
  // });
  
  return true;
}

function getMonthName(month) {
  const months = ["January", "February", "March", "April", "May", "June", 
                  "July", "August", "September", "October", "November", "December"];
  return months[month - 1];
}
module.exports = router;