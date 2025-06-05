const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error("\x1b[31mPlease provide an email address!\x1b[0m");
  console.log("Usage: node details.js <email>");
  process.exit(1);
}

// MongoDB URI (using the one from .env file)
const MONGODB_URI =
  "mongodb+srv://jhaa213152:HoU56MvoxrSuNJ0o@sachin0.fbo26lq.mongodb.net/?retryWrites=true&w=majority";

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("\x1b[36mConnected to MongoDB...\x1b[0m");
    findUserByEmail(email);
  })
  .catch((err) => {
    console.error("\x1b[31mCould not connect to MongoDB:\x1b[0m", err);
    process.exit(1);
  });

async function findUserByEmail(email) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error("\x1b[31mNo user found with email:", email, "\x1b[0m");
      process.exit(1);
    }

    // Format the output
    console.log("\n\x1b[32m=== User Details ===\x1b[0m");
    console.log("\x1b[36mBasic Information:\x1b[0m");
    console.log("Name:", user.name);
    console.log("Email:", user.email);
    console.log("UID:", user.uid);
    console.log("Referral Code:", user.referralCode);
    console.log("Coins:", user.coins);

    if (user.phone || user.dateOfBirth || user.gender) {
      console.log("\n\x1b[36mProfile Information:\x1b[0m");
      if (user.phone) console.log("Phone:", user.phone);
      if (user.dateOfBirth)
        console.log(
          "Date of Birth:",
          new Date(user.dateOfBirth).toLocaleDateString()
        );
      if (user.gender) console.log("Gender:", user.gender);
    }

    if (user.deviceInfo || user.advertisingID !== undefined) {
      console.log("\n\x1b[36mDevice Information:\x1b[0m");
      console.log(
        "Advertising ID:",
        user.advertisingID || "\x1b[33m(Not set)\x1b[0m"
      );
      if (user.deviceInfo) {
        if (user.deviceInfo.platform)
          console.log("Platform:", user.deviceInfo.platform);
        if (user.deviceInfo.version)
          console.log("OS Version:", user.deviceInfo.version);
        if (user.deviceInfo.model)
          console.log("Device Model:", user.deviceInfo.model);
        if (user.deviceInfo.manufacturer)
          console.log("Manufacturer:", user.deviceInfo.manufacturer);
        if (user.deviceInfo.lastUpdated)
          console.log(
            "Last Updated:",
            new Date(user.deviceInfo.lastUpdated).toLocaleString()
          );
      } else {
        console.log("\x1b[33mNo device info available\x1b[0m");
      }
    }

    if (user.paymentMethod) {
      console.log("\n\x1b[36mPayment Information:\x1b[0m");
      console.log("Payment Type:", user.paymentMethod.type);
      if (user.paymentMethod.type === "upi") {
        console.log("UPI ID:", user.paymentMethod.upiId);
      } else if (user.paymentMethod.type === "bank") {
        console.log("Account Holder:", user.paymentMethod.accountHolder);
        console.log("Account Number:", user.paymentMethod.accountNumber);
        console.log("IFSC Code:", user.paymentMethod.ifscCode);
      }
    }

    if (user.referrals && user.referrals.length > 0) {
      console.log("\n\x1b[36mReferral Information:\x1b[0m");
      console.log("Referral Count:", user.referralCount || 0);
      console.log("Total Referrals:", user.referrals.length);
    }

    if (user.completedOffers && user.completedOffers.length > 0) {
      console.log("\n\x1b[36mOffer Statistics:\x1b[0m");
      console.log("Completed Offers:", user.completedOffers.length);
      console.log("Pending Offers:", user.pendingOffers.length);
      console.log("Rejected Offers:", user.rejectedOffers.length);
    }

    if (user.withdrawals && user.withdrawals.length > 0) {
      console.log("\n\x1b[36mWithdrawal Information:\x1b[0m");
      console.log("Total Withdrawals:", user.withdrawals.length);
      console.log("Pending Withdrawals:", user.pendingWithdrawals.length);
      console.log("Verified Withdrawals:", user.verifiedWithdrawals.length);
    }

    console.log("\n\x1b[36mAccount Status:\x1b[0m");
    console.log("Created:", new Date(user.createdAt).toLocaleString());
    if (user.lastCheckIn) {
      console.log(
        "Last Check-in:",
        new Date(user.lastCheckIn).toLocaleString()
      );
    }

    // Exit after displaying information
    process.exit(0);
  } catch (error) {
    console.error("\x1b[31mError finding user:\x1b[0m", error);
    process.exit(1);
  }
}
