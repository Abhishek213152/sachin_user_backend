const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
  },
  advertisingID: {
    type: String,
    default: null,
  },
  deviceInfo: {
    platform: {
      type: String,
      default: null,
    },
    version: {
      type: String,
      default: null,
    },
    manufacturer: {
      type: String,
      default: null,
    },
    model: {
      type: String,
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  profileImageUrl: {
    type: String,
    default: null,
  },
  profileImage: {
    type: String, // Will store Base64 encoded image data
    default: null,
  },
  referralCode: {
    type: String,
    unique: true,
  },
  usedReferralCode: {
    type: String,
    default: null,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  referrals: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  referralHistory: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      email: String,
      name: String,
      date: {
        type: Date,
        default: Date.now,
      },
      coinsEarned: {
        type: Number,
        default: 0,
      },
    },
  ],
  referralCount: {
    type: Number,
    default: 0,
  },
  phone: {
    type: String,
    default: null,
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other", "", null],
    default: null,
  },
  coins: {
    type: Number,
    default: 0,
  },
  completedOffers: {
    type: Array,
    default: [],
  },
  pendingOffers: {
    type: Array,
    default: [],
  },
  rejectedOffers: {
    type: Array,
    default: [],
  },
  paymentMethods: {
    type: Array,
    default: [],
  },
  paymentMethod: {
    type: Object,
    default: null,
    // Can contain either UPI ID or bank details, not both
    // Example for UPI: { type: "upi", upiId: "user@bank" }
    // Example for bank: { type: "bank", accountNumber: "123456789", ifscCode: "BANK0001", accountHolder: "User Name" }
  },
  transactions: {
    type: Array,
    default: [],
  },
  withdrawals: {
    type: Array,
    default: [],
    // Each withdrawal will have:
    // id: unique identifier,
    // amount: amount in rupees,
    // coins: coin equivalent,
    // date: date of request,
    // paymentMethod: payment method used,
    // status: "pending" or "verified",
    // verifiedDate: date when verified by admin (or null if pending),
    // verifiedBy: admin uid who verified (or null if pending)
  },
  pendingWithdrawals: {
    type: Array,
    default: [],
    // Contains withdrawals with status "pending" for easy access
  },
  verifiedWithdrawals: {
    type: Array,
    default: [],
    // Contains withdrawals with status "verified" for easy access
  },
  notifications: {
    type: Array,
    default: [],
  },
  lastCheckIn: {
    type: Date,
    default: null,
  },
  userProblems: {
    type: [
      {
        id: {
          type: String,
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["technical", "payment", "offer", "other"],
          required: true,
        },
        status: {
          type: String,
          enum: ["open", "in_progress", "resolved", "closed"],
          default: "open",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        resolvedAt: {
          type: Date,
          default: null,
        },
        adminResponse: {
          type: String,
          default: null,
        },
        attachments: [
          {
            type: String, // URLs to attached files/images
          },
        ],
      },
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
