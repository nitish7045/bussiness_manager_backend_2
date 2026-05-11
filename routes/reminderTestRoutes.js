const express = require("express");
const router = express.Router();

const {
  checkAttendanceAndSendReminder,
} = require("../services/attendanceReminderService");

router.get("/test-first", async (req, res) => {
  try {
    await checkAttendanceAndSendReminder("first");

    res.json({
      success: true,
      message: "Reminder test working",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/test-second", async (req, res) => {
  try {
    await checkAttendanceAndSendReminder("second");

    res.json({
      success: true,
      message: "Second reminder working",
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