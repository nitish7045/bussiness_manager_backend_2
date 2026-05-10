const mongoose = require("mongoose");

const broadcastHistorySchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true
  },
  workerName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    default: "custom"
  },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "success"
  },
  errorMessage: {
    type: String,
    default: null
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sentByName: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  isBulk: {
    type: Boolean,
    default: false
  },
  bulkId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model("BroadcastHistory", broadcastHistorySchema);