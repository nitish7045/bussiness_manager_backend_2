const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  checkAttendanceAndSendReminder,
} = require("../services/attendanceReminderService");

router.get("/test-first", auth, async (req, res) => {
  try {
    await checkAttendanceAndSendReminder("first");

    res.json({
      success: true,
      message: "4 PM reminder test triggered",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/test-second",auth, async (req, res) => {
  try {
    await checkAttendanceAndSendReminder("second");

    res.json({
      success: true,
      message: "9:30 PM reminder test triggered",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;