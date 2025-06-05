const express = require("express");
const router = express.Router();
const User = require("../models/User");
const generateReferralCode = require("../utils/generateReferralCode");
const { uploadImage } = require("../utils/cloudinaryUpload");

// Create or update user from Firebase auth
router.post("/sync", async (req, res) => {
  try {
    const {
      firebaseUid,
      email,
      name,
      phone,
      dateOfBirth,
      gender,
      profileImageUrl,
      advertisingID,
    } = req.body;

    if (!firebaseUid || !email) {
      return res
        .status(400)
        .json({ message: "Firebase UID and email are required" });
    }

    // First, try to find user by Firebase UID
    let user = await User.findOne({ uid: firebaseUid });

    // If not found by UID, try to find by email
    if (!user) {
      user = await User.findOne({ email });

      // If user exists with this email but different firebaseUid, update the UID
      if (user) {
        user.uid = firebaseUid;
        if (name) {
          user.name = name;
        }
        if (profileImageUrl) {
          user.profileImageUrl = profileImageUrl;
        }
        if (advertisingID) {
          user.advertisingID = advertisingID;
        }
        await user.save();
        return res.json(user);
      }
    } else {
      // User found by UID, update if needed
      let needsUpdate = false;

      if (name && user.name !== name) {
        user.name = name;
        needsUpdate = true;
      }

      if (profileImageUrl && user.profileImageUrl !== profileImageUrl) {
        user.profileImageUrl = profileImageUrl;
        needsUpdate = true;
      }

      if (advertisingID && user.advertisingID !== advertisingID) {
        user.advertisingID = advertisingID;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
      }

      return res.json(user);
    }

    // Generate a unique referral code for new user
    const userName = name || email.split("@")[0];
    let referralCode = generateReferralCode(userName);

    // Check if referral code already exists (just in case)
    let codeExists = await User.findOne({ referralCode });

    // If code exists, regenerate until we get a unique one
    while (codeExists) {
      referralCode = generateReferralCode(userName);
      codeExists = await User.findOne({ referralCode });
    }

    // No user found by either UID or email, create new user with explicit defaults
    user = new User({
      uid: firebaseUid,
      email,
      name: userName,
      referralCode,
      profileImageUrl: profileImageUrl || null,
      advertisingID: advertisingID || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      coins: 0,
      completedOffers: [],
      pendingOffers: [],
      rejectedOffers: [],
      paymentMethods: [],
      transactions: [],
      notifications: [],
      lastCheckIn: null,
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user by Firebase UID
router.get("/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update user profile
router.patch("/:firebaseUid", async (req, res) => {
  try {
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "dateOfBirth",
      "gender",
      "profileImageUrl",
      "advertisingID",
    ];
    const updates = Object.keys(req.body)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const user = await User.findOneAndUpdate(
      { uid: req.params.firebaseUid },
      updates,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add a payment method
router.post("/:firebaseUid/payment-methods", async (req, res) => {
  try {
    const { type, details } = req.body;

    if (!type || !details) {
      return res
        .status(400)
        .json({ message: "Payment type and details are required" });
    }

    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add payment method
    const paymentMethod = {
      id: Date.now().toString(), // Simple unique ID
      type,
      details,
      isDefault: user.paymentMethods.length === 0, // First one is default
    };

    user.paymentMethods.push(paymentMethod);
    await user.save();

    res.status(201).json(paymentMethod);
  } catch (error) {
    console.error("Error adding payment method:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update payment method (new single payment method)
router.post("/:firebaseUid/payment-method", async (req, res) => {
  try {
    const { type, details } = req.body;

    if (!type || !details) {
      return res
        .status(400)
        .json({ message: "Payment type and details are required" });
    }

    // Validate payment details based on type
    if (type === "upi" && !details.upiId) {
      return res.status(400).json({ message: "UPI ID is required" });
    }

    if (
      type === "bank" &&
      (!details.accountNumber || !details.ifscCode || !details.accountHolder)
    ) {
      return res.status(400).json({
        message:
          "Account number, IFSC code, and account holder name are required for bank transfer",
      });
    }

    // Update user's payment method using findOneAndUpdate
    try {
      const updatedUser = await User.findOneAndUpdate(
        { uid: req.params.firebaseUid },
        {
          $set: {
            paymentMethod: {
              type,
              ...details,
            },
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(201).json(updatedUser.paymentMethod);
    } catch (error) {
      console.error("Error updating payment method:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Daily check-in
router.post("/:firebaseUid/check-in", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
      user.lastCheckIn &&
      new Date(user.lastCheckIn).getTime() >= today.getTime()
    ) {
      return res.status(400).json({ message: "Already checked in today" });
    }

    // Add coins for check-in
    const checkInCoins = 50;
    user.coins += checkInCoins;
    user.lastCheckIn = new Date();

    // Create transaction record
    const transaction = {
      id: Date.now().toString(),
      type: "earn",
      amount: checkInCoins,
      description: "Daily check-in reward",
      date: new Date(),
    };

    // Create notification
    const notification = {
      id: Date.now().toString(),
      title: "Daily Check-in Reward!",
      message: `You earned ${checkInCoins} coins for checking in today.`,
      type: "reward",
      read: false,
      timestamp: Date.now(),
      date: new Date(),
    };

    user.transactions.unshift(transaction);
    user.notifications.unshift(notification);
    await user.save();

    // Send real-time notification via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(user.uid).emit("notification", notification);
    }

    res.json({
      message: "Check-in successful",
      coins: user.coins,
      transaction,
      notification,
    });
  } catch (error) {
    console.error("Error processing check-in:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Mark a notification as read
router.patch(
  "/:firebaseUid/notifications/:notificationId/read",
  async (req, res) => {
    try {
      // Update the specific notification using array filters
      const updatedUser = await User.findOneAndUpdate(
        { uid: req.params.firebaseUid },
        {
          $set: {
            "notifications.$[notif].read": true,
          },
        },
        {
          arrayFilters: [{ "notif.id": req.params.notificationId }],
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser.notifications);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Mark all notifications as read
router.patch("/:firebaseUid/notifications/read-all", async (req, res) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { uid: req.params.firebaseUid },
      {
        $set: {
          "notifications.$[].read": true,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser.notifications);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Clear all notifications
router.delete("/:firebaseUid/notifications/clear", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clear all notifications
    user.notifications = [];
    await user.save();

    res.json({ message: "All notifications cleared", notifications: [] });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add a notification to a user
router.post("/:firebaseUid/notifications", async (req, res) => {
  try {
    const { title, message, type = "system" } = req.body;

    if (!title || !message) {
      return res
        .status(400)
        .json({ message: "Title and message are required" });
    }

    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new notification
    const notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };

    // Add to beginning of notifications array
    user.notifications.unshift(notification);

    await user.save();

    res.status(201).json(notification);
  } catch (error) {
    console.error("Error adding notification:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Apply a referral code
router.post("/:firebaseUid/apply-referral", async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ message: "Referral code is required" });
    }

    // Find current user
    const currentUser = await User.findOne({ uid: req.params.firebaseUid });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find user with this referral code
    const referralUser = await User.findOne({ referralCode });
    if (!referralUser) {
      return res.status(404).json({ message: "Invalid referral code" });
    }

    // Prevent self-referral
    if (currentUser._id.toString() === referralUser._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot use your own referral code" });
    }

    // Check if user has already used a referral code (checking completed referrals)
    if (currentUser.usedReferralCode) {
      return res
        .status(400)
        .json({ message: "You have already used a referral code" });
    }

    // Add coins to both users and mark referral as used
    const REFERRAL_BONUS = 500; // 500 coins bonus for referrer

    // Update current user
    currentUser.usedReferralCode = referralCode;
    currentUser.referredBy = referralUser._id; // Store who referred this user

    // Create a transaction record for current user (no bonus for them)
    const currentUserTransaction = {
      id: Date.now().toString(),
      type: "referral_applied",
      amount: 0,
      description: `Applied referral code: ${referralCode}`,
      date: new Date(),
    };

    currentUser.transactions.unshift(currentUserTransaction);

    // Add a notification
    const currentUserNotification = {
      id: Date.now().toString() + "1",
      type: "referral",
      title: "Referral Applied!",
      message: `You've successfully applied the referral code!`,
      timestamp: Date.now(),
      read: false,
    };

    currentUser.notifications.unshift(currentUserNotification);

    // Update referral user with 500 coins
    referralUser.coins += REFERRAL_BONUS;

    // Add the current user to the referral user's referrals array
    if (!referralUser.referrals) {
      referralUser.referrals = [];
    }
    referralUser.referrals.push(currentUser._id);

    // Add to referral history
    if (!referralUser.referralHistory) {
      referralUser.referralHistory = [];
    }

    referralUser.referralHistory.push({
      userId: currentUser._id,
      email: currentUser.email,
      name: currentUser.name || "User",
      date: new Date(),
      coinsEarned: REFERRAL_BONUS,
    });

    // Update referral count
    referralUser.referralCount = (referralUser.referralCount || 0) + 1;

    // Create a transaction record for referral user
    const referralUserTransaction = {
      id: (Date.now() + 1).toString(),
      type: "referral_bonus",
      amount: REFERRAL_BONUS,
      description: `Received ${REFERRAL_BONUS} coins for referring a new user`,
      date: new Date(),
    };

    referralUser.transactions.unshift(referralUserTransaction);

    // Add a notification for referral user
    const referralUserNotification = {
      id: Date.now().toString() + "2",
      type: "bonus",
      title: "Referral Bonus!",
      message: `You received ${REFERRAL_BONUS} coins because someone used your referral code!`,
      timestamp: Date.now(),
      read: false,
    };

    referralUser.notifications.unshift(referralUserNotification);

    // Save both users
    await Promise.all([currentUser.save(), referralUser.save()]);

    res.json({
      message: "Referral code applied successfully!",
      bonus: 0, // The current user doesn't get a bonus anymore
      referrerBonus: REFERRAL_BONUS, // Include the referrer's bonus for information
      user: currentUser,
    });
  } catch (error) {
    console.error("Error applying referral code:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user's referral history
router.get("/:firebaseUid/referral-history", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get details of who referred this user
    let referredByUser = null;
    if (user.referredBy) {
      referredByUser = await User.findById(
        user.referredBy,
        "name email referralCode"
      );
    }

    // Get details of users referred by this user
    let referredUsers = [];
    if (user.referrals && user.referrals.length > 0) {
      referredUsers = await User.find(
        { _id: { $in: user.referrals } },
        "name email dateCreated"
      );
    }

    res.json({
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referredBy: referredByUser,
      referredUsers: referredUsers,
      referralHistory: user.referralHistory || [],
      totalCoinsEarned: (user.referralHistory || []).reduce(
        (sum, ref) => sum + ref.coinsEarned,
        0
      ),
    });
  } catch (error) {
    console.error("Error fetching referral history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Request a withdrawal
router.post("/:firebaseUid/withdraw", async (req, res) => {
  try {
    const { amount } = req.body;
    const timestamp = new Date().toISOString();
    console.log("Withdraw request received:", {
      amount,
      userId: req.params.firebaseUid,
      timestamp,
      raw_body: JSON.stringify(req.body),
    });

    // Validate amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.error(`[${timestamp}] Invalid amount: ${amount}`);
      return res.status(400).json({ message: "Valid amount is required" });
    }

    // Convert amount to number and ensure it's a valid amount
    const amountNumber = parseFloat(amount);

    // Convert rupees to coins (1 coin = 0.1 rupees)
    const conversionRate = 0.1; // This should match the frontend rate

    // Calculate coins required - ensure consistent calculation
    const coinsRequired = Math.ceil(amountNumber / conversionRate);

    console.log(`[${timestamp}] Conversion calculation:`, {
      amountRupees: amountNumber,
      conversionRate,
      coinsRequired,
      calculation: `${amountNumber} ÷ ${conversionRate} = ${
        amountNumber / conversionRate
      } → ${coinsRequired}`,
    });

    // Find the user
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      console.error(`[${timestamp}] User not found: ${req.params.firebaseUid}`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`[${timestamp}] User found:`, {
      userId: user.uid,
      currentCoins: user.coins,
    });

    // Check if user has enough coins
    if (user.coins < coinsRequired) {
      console.error(`[${timestamp}] Insufficient coins:`, {
        required: coinsRequired,
        available: user.coins,
      });
      return res.status(400).json({
        message: "Insufficient coins for this withdrawal",
        available: user.coins,
        required: coinsRequired,
      });
    }

    // Check if user has a payment method set
    if (!user.paymentMethod) {
      console.error(`[${timestamp}] No payment method found`);
      return res.status(400).json({
        message: "No payment method found. Please add a payment method first.",
      });
    }

    // Create a withdrawal record
    const withdrawalId = Date.now().toString();
    const withdrawal = {
      id: withdrawalId,
      amount: amountNumber,
      coins: coinsRequired,
      date: new Date(),
      paymentMethod: user.paymentMethod,
      status: "pending",
      verifiedDate: null,
      verifiedBy: null,
    };

    // Create a transaction record
    const transaction = {
      id: withdrawalId,
      type: "withdraw",
      amount: -coinsRequired, // Negative to indicate coins leaving account
      description: `Withdrawal request for ₹${amountNumber.toFixed(2)}`,
      date: new Date(),
      status: "pending",
      paymentMethod: user.paymentMethod,
    };

    // Create a notification
    const notification = {
      id: Date.now().toString(),
      type: "withdrawal",
      title: "Withdrawal Requested",
      message: `Your withdrawal request for ₹${amountNumber.toFixed(
        2
      )} has been received and is pending approval.`,
      timestamp: Date.now(),
      read: false,
    };

    // Update the user document using findOneAndUpdate
    try {
      const updatedUser = await User.findOneAndUpdate(
        { uid: req.params.firebaseUid },
        {
          $inc: { coins: -coinsRequired },
          $push: {
            withdrawals: { $each: [withdrawal], $position: 0 },
            pendingWithdrawals: { $each: [withdrawal], $position: 0 },
            transactions: { $each: [transaction], $position: 0 },
            notifications: { $each: [notification], $position: 0 },
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new Error("Failed to update user document");
      }

      console.log(`[${timestamp}] Withdrawal processed successfully:`, {
        withdrawalId,
        amount: amountNumber,
        coins: coinsRequired,
        newBalance: updatedUser.coins,
      });

      res.status(201).json({
        message: "Withdrawal request submitted successfully",
        withdrawal: withdrawal,
        newBalance: updatedUser.coins,
        deductedCoins: coinsRequired,
      });
    } catch (saveError) {
      console.error(`[${timestamp}] Error saving user document:`, saveError);
      res.status(500).json({
        message: "Failed to save withdrawal data",
        error: saveError.message,
      });
    }
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing withdrawal request:`,
      error
    );
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Admin route to verify a withdrawal
router.patch(
  "/:firebaseUid/withdrawals/:withdrawalId/verify",
  async (req, res) => {
    try {
      const { adminUid } = req.body;

      if (!adminUid) {
        return res
          .status(400)
          .json({ message: "Admin UID is required for verification" });
      }

      const user = await User.findOne({ uid: req.params.firebaseUid });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Find the withdrawal in pendingWithdrawals
      const pendingIndex = user.pendingWithdrawals.findIndex(
        (w) => w.id === req.params.withdrawalId
      );

      if (pendingIndex === -1) {
        return res
          .status(404)
          .json({ message: "Pending withdrawal not found" });
      }

      // Find the withdrawal in the main withdrawals array
      const withdrawalIndex = user.withdrawals.findIndex(
        (w) => w.id === req.params.withdrawalId
      );

      if (withdrawalIndex === -1) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      // Update the withdrawal status
      user.withdrawals[withdrawalIndex].status = "verified";
      user.withdrawals[withdrawalIndex].verifiedDate = new Date();
      user.withdrawals[withdrawalIndex].verifiedBy = adminUid;

      // Move from pending to verified
      const verifiedWithdrawal = { ...user.pendingWithdrawals[pendingIndex] };
      verifiedWithdrawal.status = "verified";
      verifiedWithdrawal.verifiedDate = new Date();
      verifiedWithdrawal.verifiedBy = adminUid;

      user.verifiedWithdrawals.unshift(verifiedWithdrawal);
      user.pendingWithdrawals.splice(pendingIndex, 1);

      // Update the transaction status
      const transactionIndex = user.transactions.findIndex(
        (t) => t.id === req.params.withdrawalId
      );

      if (transactionIndex !== -1) {
        user.transactions[transactionIndex].status = "completed";
      }

      // Add a notification
      const notification = {
        id: Date.now().toString(),
        type: "withdrawal_verified",
        title: "Withdrawal Verified",
        message: `Your withdrawal request for ₹${user.withdrawals[withdrawalIndex].amount} has been verified and processed.`,
        timestamp: Date.now(),
        read: false,
      };

      user.notifications.unshift(notification);

      await user.save();

      res.json({
        message: "Withdrawal verified successfully",
        withdrawal: user.withdrawals[withdrawalIndex],
      });
    } catch (error) {
      console.error("Error verifying withdrawal:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get user's withdrawal history
router.get("/:firebaseUid/withdrawals", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      all: user.withdrawals,
      pending: user.pendingWithdrawals,
      verified: user.verifiedWithdrawals,
    });
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update user profile
router.patch("/profile/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const updates = req.body;

    // Check for allowed updates
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "gender",
      "dateOfBirth",
      "profileImageUrl",
      "profileImage", // New field for Base64 image
    ];

    // Validate updates
    const isValidOperation = Object.keys(updates).every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ error: "Invalid updates!" });
    }

    // Find and update user
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Apply updates
    Object.keys(updates).forEach((update) => {
      user[update] = updates[update];
    });

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add new route for uploading profile image to Cloudinary
router.post("/profile-image/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const { imageData } = req.body; // Base64 encoded image

    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // Find user
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    try {
      // Upload image to Cloudinary
      const uploadResult = await uploadImage(imageData, uid);

      // Store the image URL in MongoDB (not the actual image)
      user.profileImageUrl = uploadResult.secure_url;
      // Clear the profileImage field if it was previously storing base64
      user.profileImage = null;

      await user.save();
      console.log(
        `Profile image successfully updated for user ${uid}, URL: ${uploadResult.secure_url}`
      );

      res.json({
        success: true,
        message: "Profile image updated successfully",
        imageUrl: uploadResult.secure_url,
      });
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({
        error: "Image upload failed",
        message:
          uploadError.message || "Failed to upload image to cloud storage",
      });
    }
  } catch (error) {
    console.error("Error uploading profile image:", error);
    res.status(500).json({
      error: "Failed to update profile image",
      message: error.message || "Something went wrong!",
    });
  }
});

// Create a new user problem
router.post("/:firebaseUid/problems", async (req, res) => {
  try {
    const { title, description, type, attachments } = req.body;

    if (!title || !description || !type) {
      return res
        .status(400)
        .json({ message: "Title, description, and type are required" });
    }

    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new problem
    const problem = {
      id: Date.now().toString(),
      title,
      description,
      type,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      attachments: attachments || [],
    };

    // Add to user's problems array
    user.userProblems.unshift(problem);
    await user.save();

    // Add a notification about the problem submission
    const notification = {
      id: Date.now().toString() + "_notification",
      type: "problem",
      title: "Problem Submitted",
      message: `Your problem "${title}" has been submitted. We'll get back to you soon.`,
      timestamp: Date.now(),
      read: false,
    };

    user.notifications.unshift(notification);
    await user.save();

    res.status(201).json(problem);
  } catch (error) {
    console.error("Error creating user problem:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all problems for a user
router.get("/:firebaseUid/problems", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.userProblems);
  } catch (error) {
    console.error("Error fetching user problems:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a specific problem for a user
router.get("/:firebaseUid/problems/:problemId", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const problem = user.userProblems.find(
      (p) => p.id === req.params.problemId
    );

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    res.json(problem);
  } catch (error) {
    console.error("Error fetching user problem:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a problem's status
router.patch("/:firebaseUid/problems/:problemId", async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const problemIndex = user.userProblems.findIndex(
      (p) => p.id === req.params.problemId
    );

    if (problemIndex === -1) {
      return res.status(404).json({ message: "Problem not found" });
    }

    // Update problem
    user.userProblems[problemIndex].status = status;
    user.userProblems[problemIndex].updatedAt = new Date();

    if (adminResponse) {
      user.userProblems[problemIndex].adminResponse = adminResponse;
    }

    if (status === "resolved" || status === "closed") {
      user.userProblems[problemIndex].resolvedAt = new Date();
    }

    await user.save();

    // Add a notification about the problem update
    const notification = {
      id: Date.now().toString() + "_notification",
      type: "problem_update",
      title: "Problem Status Updated",
      message: `Your problem "${user.userProblems[problemIndex].title}" has been ${status}.`,
      timestamp: Date.now(),
      read: false,
    };

    user.notifications.unshift(notification);
    await user.save();

    res.json(user.userProblems[problemIndex]);
  } catch (error) {
    console.error("Error updating user problem:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add attachments to a problem
router.post(
  "/:firebaseUid/problems/:problemId/attachments",
  async (req, res) => {
    try {
      const { attachments } = req.body;

      if (!attachments || !Array.isArray(attachments)) {
        return res
          .status(400)
          .json({ message: "Attachments array is required" });
      }

      const user = await User.findOne({ uid: req.params.firebaseUid });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const problemIndex = user.userProblems.findIndex(
        (p) => p.id === req.params.problemId
      );

      if (problemIndex === -1) {
        return res.status(404).json({ message: "Problem not found" });
      }

      // Add new attachments
      user.userProblems[problemIndex].attachments.push(...attachments);
      user.userProblems[problemIndex].updatedAt = new Date();

      await user.save();

      res.json(user.userProblems[problemIndex]);
    } catch (error) {
      console.error("Error adding attachments to problem:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
