const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

// 🔥 IMPORTANT: Increase payload limit for Base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// DB connect
connectDB();

// ==================== MAIN APP ROUTES ====================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/advance", require("./routes/advanceRoutes"));
app.use("/api/salary", require("./routes/salaryRoutes"));
app.use("/api/uploads", require("./routes/uploadRoutes"));

// ==================== BILLING MODULE ROUTES ====================
// Billing Authentication
app.use("/api/billing/auth", require("./routes/billingAuthRoutes"));

// Billing Product Management
app.use("/api/billing/products", require("./routes/billingProductRoutes"));

// Billing Customer Management
app.use("/api/billing/customers", require("./routes/billingCustomerRoutes"));

// Billing Invoice Management
app.use("/api/billing/invoices", require("./routes/billingInvoiceRoutes"));

// Billing Dashboard/Stats
app.use("/api/billing/stats", require("./routes/billingStatsRoutes"));
// Add this line with your other billing routes
app.use("/api/billing/banks", require("./routes/billingBankRoutes"));
// Add these lines to your server.js file

// Add this with other billing routes
app.use("/api/billing/uploads", require("./routes/billingUploadRoutes"));
// Add this line with your other billing routes
app.use("/api/billing/companies", require("./routes/billingCompanyRoutes"));

// ==================== ERROR HANDLING ====================
// Error handling middleware for payload too large
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      msg: "File too large. Maximum size is 50MB." 
    });
  }
  next(err);
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    msg: "Route not found",
    path: req.originalUrl 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ 
    msg: "Internal server error", 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Keep Alive Route
app.get("/keep-alive", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is alive",
    time: new Date(),
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📸 Image upload limit: 50MB`);
  console.log(`📊 Main App API: /api/`);
  console.log(`🧾 Billing API: /api/billing/`);
  console.log(`✅ All routes registered successfully`);
});