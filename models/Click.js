const mongoose = require("mongoose");

const clickSchema = new mongoose.Schema({
  clickId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
    required: true,
  },
  upi: {
    type: String,
    required: true,
  },
  rewardCoins: {
    type: Number,
    default: 0,
  },
  isRewarded: {
    type: Boolean,
    default: false,
  },
  rewardedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    default: "pending",
  },
  ipAddress: {
    type: String,
    default: null,
  },
  deviceInfo: {
    type: Object,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
clickSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Create indexes for better query performance
clickSchema.index({ clickId: 1 });
clickSchema.index({ userId: 1 });
clickSchema.index({ offerId: 1 });
clickSchema.index({ createdAt: 1 });
clickSchema.index({ status: 1 });

module.exports = mongoose.model("Click", clickSchema);
