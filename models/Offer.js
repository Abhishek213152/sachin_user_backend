const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  coins: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["daily", "video", "install", "share", "prime"],
    required: true,
  },
  requirements: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: "",
  },
  developer: {
    type: String,
    default: "",
  },
  rating: {
    type: Number,
    default: 4.0,
  },
  downloads: {
    type: String,
    default: "",
  },
  category: {
    type: String,
    default: "",
  },
  appLink: {
    type: String,
    default: "",
  },
  trackingUrl: {
    type: String,
    required: true,
    default: "",
  },
  deadline: {
    type: String,
    default: "7 days",
  },
  steps: {
    type: Array,
    default: [],
  },
  offerCategory: {
    type: String,
    enum: ["regular", "prime"],
    default: "regular",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  completedBy: {
    type: Array,
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Offer", offerSchema);
