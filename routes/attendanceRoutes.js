//routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance");
const User = require("../models/User"); // ← Add this import
const auth = require("../middleware/authMiddleware");
const { sendWhatsAppMessage } = require("../services/whatsappService"); // ← Add this import

// ➕ Add attendance
router.post("/add", auth, async (req, res) => {
  try {
    const { workerId, date, status, overtimeHours, remark } = req.body;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ msg: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Check for duplicate attendance
    const existing = await Attendance.findOne({
      workerId,
      date,
      companyId: req.user.companyId
    });

    if (existing) {
      return res.status(400).json({ 
        msg: "Attendance already marked for this date",
        existing: existing 
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      workerId,
      companyId: req.user.companyId,
      date,
      status: status || "present",
      overtimeHours: overtimeHours || 0,
      remark: remark || ""
    });

    await attendance.save();

    // Populate worker details before sending response
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("workerId", "name designation wages");

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: populatedAttendance
    });

  } catch (err) {
    console.error("Error adding attendance:", err);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: "Attendance already marked for this worker on this date" 
      });
    }
    
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 📄 Get monthly attendance (with optional worker filter)
router.get("/", auth, async (req, res) => {
  try {
    const { month, year, workerId } = req.query;

    // Validate month and year
    if (!month || !year) {
      return res.status(400).json({ msg: "Month and year are required" });
    }

    // Format date range for the month
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    
    // Get last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Build query
    const query = {
      companyId: req.user.companyId,
      date: { $gte: startDate, $lte: endDate }
    };

    // Add worker filter if provided
    if (workerId) {
      query.workerId = workerId;
    }

    // Fetch attendance with worker details
    const data = await Attendance.find(query)
      .populate("workerId", "name designation wages")
      .sort({ date: 1 }); // Sort by date ascending

    res.json({
      success: true,
      data: data,
      meta: {
        month: month,
        year: year,
        startDate: startDate,
        endDate: endDate,
        total: data.length
      }
    });

  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 🔄 Update attendance
router.put("/update", auth, async (req, res) => {
  try {
    const { workerId, date, status, overtimeHours, remark } = req.body;

    // Validate date format if provided
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ msg: "Invalid date format. Use YYYY-MM-DD" });
      }
    }

    // Find the attendance record
    const attendance = await Attendance.findOne({
      workerId,
      date,
      companyId: req.user.companyId
    });

    if (!attendance) {
      return res.status(404).json({ 
        msg: "Attendance record not found for this worker on this date" 
      });
    }

    // Update fields
    if (status) attendance.status = status;
    if (overtimeHours !== undefined) attendance.overtimeHours = overtimeHours;
    if (remark !== undefined) attendance.remark = remark;

    await attendance.save();

    // Populate worker details
    const updatedAttendance = await Attendance.findById(attendance._id)
      .populate("workerId", "name designation wages");

    res.json({
      success: true,
      message: "Attendance updated successfully",
      data: updatedAttendance
    });

  } catch (err) {
    console.error("Error updating attendance:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 📊 Get attendance for a specific date
router.get("/date/:date", auth, async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ msg: "Invalid date format. Use YYYY-MM-DD" });
    }

    const attendance = await Attendance.find({
      companyId: req.user.companyId,
      date: date
    }).populate("workerId", "name designation wages");

    res.json({
      success: true,
      date: date,
      data: attendance,
      total: attendance.length
    });

  } catch (err) {
    console.error("Error fetching attendance by date:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 📈 Get attendance statistics for a month
router.get("/stats", auth, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ msg: "Month and year are required" });
    }

    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const stats = await Attendance.aggregate([
      {
        $match: {
          companyId: req.user.companyId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalOvertime: { $sum: "$overtimeHours" }
        }
      }
    ]);

    // Get total unique workers who marked attendance
    const totalWorkers = await Attendance.distinct("workerId", {
      companyId: req.user.companyId,
      date: { $gte: startDate, $lte: endDate }
    });

    res.json({
      success: true,
      month: month,
      year: year,
      stats: stats,
      totalWorkersMarked: totalWorkers.length,
      startDate: startDate,
      endDate: endDate
    });

  } catch (err) {
    console.error("Error fetching attendance stats:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// ======================================================
// 📱 SEND ATTENDANCE REMINDER VIA WHATSAPP (NEW)
// ======================================================
router.post("/send-reminder", auth, async (req, res) => {
  try {
    const { reminderMessage, unmarkedCount, reminderTime } = req.body;
    
    // Get user details from the authenticated user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }
    
    // Get WhatsApp number from company settings
    const whatsappNumber = user.companyDetails?.whatsappNumber;
    
    if (!whatsappNumber) {
      console.log("No WhatsApp number configured for this user");
      return res.status(200).json({
        success: false,
        msg: "WhatsApp number not configured. Please add in Company Settings."
      });
    }
    
    // Format the message with better structure
    const formattedMessage = `
*🏢 Business Manager (Nitish Software)*
━━━━━━━━━━━━━━━━━━━━━━━

${reminderMessage}

━━━━━━━━━━━━━━━━━━━━━━━
*📱 Need help?*
Contact your administrator
━━━━━━━━━━━━━━━━━━━━━━━`;
    
    // Send WhatsApp message
    await sendWhatsAppMessage(whatsappNumber, formattedMessage);
    
    console.log(`✅ Attendance reminder sent at ${reminderTime} to ${whatsappNumber}`);
    
    res.status(200).json({
      success: true,
      msg: "Reminder sent successfully",
      reminderTime: reminderTime,
      unmarkedCount: unmarkedCount
    });
    
  } catch (error) {
    console.error("Error sending attendance reminder:", error);
    res.status(500).json({
      success: false,
      msg: "Failed to send reminder",
      error: error.message
    });
  }
});

// 🗑️ Delete attendance record
router.delete("/:id", auth, async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!attendance) {
      return res.status(404).json({ msg: "Attendance record not found" });
    }
    
    await attendance.deleteOne();
    res.json({ 
      success: true, 
      msg: "Attendance record deleted successfully" 
    });
    
  } catch (err) {
    console.error("Error deleting attendance:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 📋 Get attendance by worker for a specific month
router.get("/worker/:workerId", auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ msg: "Month and year are required" });
    }

    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const attendance = await Attendance.find({
      workerId: workerId,
      companyId: req.user.companyId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.json({
      success: true,
      data: attendance,
      meta: {
        workerId: workerId,
        month: month,
        year: year,
        total: attendance.length
      }
    });

  } catch (err) {
    console.error("Error fetching worker attendance:", err);
    res.status(500).json({ 
      msg: "Server error", 
      error: err.message 
    });
  }
});

// 🗑️ Delete attendance by workerId and date
router.delete("/:workerId/:date", auth, async (req, res) => {
  try {
    const { workerId, date } = req.params;
    
    const attendance = await Attendance.findOneAndDelete({
      workerId,
      date,
      companyId: req.user.companyId
    });
    
    if (!attendance) {
      return res.status(404).json({ msg: "Attendance record not found" });
    }
    
    res.json({ msg: "Attendance record deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error deleting attendance record" });
  }
});

module.exports = router;