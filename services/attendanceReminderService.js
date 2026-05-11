const cron = require("node-cron");

const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const User = require("../models/User");

const {
  sendWhatsAppMessage,
} = require("./whatsappService");

// Send WhatsApp reminder
const sendWhatsAppReminder = async (
  unmarkedCount,
  totalActive,
  timeOfDay,
  whatsappNumber,
  companyId
) => {
  try {
    const completionRate = Math.round(
      ((totalActive - unmarkedCount) / totalActive) * 100
    );

    const reminderMessage =
      timeOfDay === "first"
        ? `🌤️ *Evening Attendance Reminder (4:00 PM)*

⚠️ *${unmarkedCount}* workers haven't marked attendance yet today.

📊 *Stats:*
• Total Active Workers: ${totalActive}
• Pending Markings: ${unmarkedCount}
• Completion Rate: ${completionRate}%

⏰ Please remind workers to mark attendance before end of day.

━━━━━━━━━━━━━━━━━━━━━━━
*Use Attendance Management section*
✅ Mark attendance now to avoid late entries`
        : `🌙 *Night Attendance Reminder (9:30 PM)*

⚠️ *CRITICAL: ${unmarkedCount}* workers still haven't marked attendance today!

📊 *Stats:*
• Total Active Workers: ${totalActive}
• Pending Markings: ${unmarkedCount}
• Completion Rate: ${completionRate}%

⏰ LAST CHANCE to mark attendance for today!

━━━━━━━━━━━━━━━━━━━━━━━
*⚠️ Important:*
Unmarked attendance will be marked as ABSENT
This will affect salary and payroll

*Please mark attendance immediately!*`;

    // Clean WhatsApp number
    let cleanNumber =
      whatsappNumber.replace(/\D/g, "");

    if (!cleanNumber.startsWith("91")) {
      cleanNumber = `91${cleanNumber}`;
    }

    // Send WhatsApp message
    await sendWhatsAppMessage(
      cleanNumber,
      reminderMessage
    );

    // Clean company log only
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 Attendance Reminder Sent
🏢 Company ID: ${companyId}
👥 Total Workers: ${totalActive}
❌ Unmarked Workers: ${unmarkedCount}
📱 WhatsApp: ${cleanNumber}
⏰ Time: ${timeOfDay}
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  } catch (error) {
    console.error("Reminder Error:", error);
  }
};

// Main reminder checker
const checkAttendanceAndSendReminder = async (
  timeOfDay
) => {
  try {
    const today = new Date();

    const day = String(today.getDate()).padStart(
      2,
      "0"
    );

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const year = today.getFullYear();

    const todayStr = `${year}-${month}-${day}`;

    // Get all companies/users having WhatsApp number
    const companies = await User.find({
      "companyDetails.whatsappNumber": {
        $exists: true,
        $ne: "",
      },
    });

    // Loop each company separately
    for (const company of companies) {

      const companyId = company.companyId;

      const whatsappNumber =
        company.companyDetails.whatsappNumber;

      // Get active workers for THIS company only
      const activeWorkers = await Employee.find({
        status: "active",
        companyId: companyId,
      });

      // Skip if no workers
      if (activeWorkers.length === 0) {
        continue;
      }

      // Get today's attendance for THIS company only
      const attendance = await Attendance.find({
        date: todayStr,
        companyId: companyId,
      });

      // Worker IDs who marked attendance
      const markedWorkerIds = attendance.map((a) =>
        a.workerId.toString()
      );

      // Find unmarked workers
      const unmarkedWorkers = activeWorkers.filter(
        (worker) =>
          !markedWorkerIds.includes(
            worker._id.toString()
          )
      );

      const unmarkedCount =
        unmarkedWorkers.length;

      // Send reminder only if pending workers exist
      if (unmarkedCount > 0) {

        await sendWhatsAppReminder(
          unmarkedCount,
          activeWorkers.length,
          timeOfDay,
          whatsappNumber,
          companyId
        );

      }
    }

  } catch (error) {
    console.error("Cron Error:", error);
  }
};

// 4:00 PM daily
cron.schedule(
  "0 16 * * *",
  async () => {
    await checkAttendanceAndSendReminder("first");
  },
  {
    timezone: "Asia/Kolkata",
  }
);

// 9:30 PM daily
cron.schedule(
  "30 21 * * *",
  async () => {
    await checkAttendanceAndSendReminder("second");
  },
  {
    timezone: "Asia/Kolkata",
  }
);

module.exports = {
  checkAttendanceAndSendReminder,
};