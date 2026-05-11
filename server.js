const express = require("express");
const cors = require("cors");
require("dotenv").config();
const {
  connectWhatsApp,
} = require("./services/whatsappService");
// Add this with your other route imports
const whatsappRoutes = require("./routes/whatsappRoutes");
// const whatsappRoutes = require("./routes/whatsappRoutes");
require("./services/attendanceReminderService");

const connectDB = require("./config/db");

const app = express();

// 🔥 IMPORTANT: Increase payload limit for Base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.set("trust proxy", true);

// ==================== CORS CONFIGURATION ====================
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ==================== DATABASE CONNECTION ====================
connectDB();

// ==================== MAIN APP ROUTES ====================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/advance", require("./routes/advanceRoutes"));
app.use("/api/salary", require("./routes/salaryRoutes"));
app.use("/api/uploads", require("./routes/uploadRoutes"));

// ==================== BROADCAST ROUTES ====================

// Add this with your other app.use routes
// app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));  // ← ADD THIS
app.use("/api/broadcast", require("./routes/broadcastRoutes"));
app.use("/api/reminder", require("./routes/reminderTestRoutes"));

// ==================== BILLING MODULE ROUTES ====================

// Billing Authentication
app.use(
  "/api/billing/auth",
  require("./routes/billingAuthRoutes")
);

// Billing Product Management
app.use(
  "/api/billing/products",
  require("./routes/billingProductRoutes")
);

// Billing Customer Management
app.use(
  "/api/billing/customers",
  require("./routes/billingCustomerRoutes")
);

// Billing Invoice Management
app.use(
  "/api/billing/invoices",
  require("./routes/billingInvoiceRoutes")
);

// Billing Dashboard/Stats
app.use(
  "/api/billing/stats",
  require("./routes/billingStatsRoutes")
);

// Billing Bank Routes
app.use(
  "/api/billing/banks",
  require("./routes/billingBankRoutes")
);

// Billing Upload Routes
app.use(
  "/api/billing/uploads",
  require("./routes/billingUploadRoutes")
);

// Billing Company Routes
app.use(
  "/api/billing/companies",
  require("./routes/billingCompanyRoutes")
);

// ==================== KEEP ALIVE ROUTE ====================
app.get("/keep-alive", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is alive",
    time: new Date(),
  });
});

// ==================== ERROR HANDLING ====================

// Payload too large handler
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      msg: "File too large. Maximum size is 50MB.",
    });
  }
  next(err);
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    msg: "Route not found",
    path: req.originalUrl,
  });
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    msg: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📸 Image upload limit: 50MB`);
  console.log(`📊 Main App API: /api/`);
  console.log(`📱 Broadcast API: /api/broadcast/`);
  console.log(`🧾 Billing API: /api/billing/`);
  console.log(`💓 Keep Alive Route: /keep-alive`);
  console.log(`✅ All routes registered successfully`);
  connectWhatsApp();
});