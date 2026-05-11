const cron = require("node-cron");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");

const sendWhatsAppReminder = async (
  unmarkedCount,
  totalActive,
  timeOfDay
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

⏰ Please remind workers to mark attendance before end of day.`
        : `🌙 *Night Attendance Reminder (9:30 PM)*

⚠️ *CRITICAL: ${unmarkedCount}* workers still haven't marked attendance today!

📊 *Stats:*
• Total Active Workers: ${totalActive}
• Pending Markings: ${unmarkedCount}
• Completion Rate: ${completionRate}%

⏰ LAST CHANCE to mark attendance for today!`;

    console.log("Sending Reminder:", reminderMessage);

    // CALL YOUR WHATSAPP API HERE
    // await axios.post(...)

  } catch (error) {
    console.error("Reminder Error:", error);
  }
};

const checkAttendanceAndSendReminder = async (timeOfDay) => {
  try {
    const today = new Date();

    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    const todayStr = `${year}-${month}-${day}`;

    const activeWorkers = await Employee.find({
      status: "active",
    });

    const attendance = await Attendance.find({
      date: todayStr,
    });

    const markedWorkerIds = attendance.map((a) =>
      a.workerId.toString()
    );

    const unmarkedWorkers = activeWorkers.filter(
      (worker) => !markedWorkerIds.includes(worker._id.toString())
    );

    const unmarkedCount = unmarkedWorkers.length;

    if (unmarkedCount > 0) {
      await sendWhatsAppReminder(
        unmarkedCount,
        activeWorkers.length,
        timeOfDay
      );
    }

    console.log(
      `[${timeOfDay}] Reminder Check Complete`
    );
  } catch (error) {
    console.error("Cron Error:", error);
  }
};

// 4:00 PM daily
cron.schedule("0 16 * * *", async () => {
  await checkAttendanceAndSendReminder("first");
});

// 9:30 PM daily
cron.schedule("30 21 * * *", async () => {
  await checkAttendanceAndSendReminder("second");
});

module.exports = {
  checkAttendanceAndSendReminder,
};