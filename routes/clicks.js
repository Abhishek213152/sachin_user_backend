const express = require("express");
const router = express.Router();
const Click = require("../models/Click");
const User = require("../models/User");
const Offer = require("../models/Offer");
const crypto = require("crypto");

// Helper function to generate click ID
const generateClickId = (userId, offerId) => {
  const timestamp = Date.now();
  const data = `${userId}_${offerId}_${timestamp}`;
  // Create a hash of the data and take first 12 characters
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 12);
};

// Generate a click ID and store click info
router.post("/create", async (req, res) => {
  try {
    const { userId, offerId, upi } = req.body;

    // Validate required fields
    if (!userId || !offerId || !upi) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Check if user and offer exist
    const [user, offer] = await Promise.all([
      User.findById(userId),
      Offer.findById(offerId),
    ]);

    if (!user || !offer) {
      return res.status(404).json({
        success: false,
        message: "User or offer not found",
      });
    }

    // Check if user already has a pending or processing click for this offer
    const existingClick = await Click.findOne({
      userId,
      offerId,
      status: { $in: ["pending", "clicked"] },
    });

    if (existingClick) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending click for this offer",
        clickId: existingClick.clickId,
        pcid: existingClick.clickId, // Adding pcid for compatibility
      });
    }

    // Generate unique click ID using userId and timestamp
    const clickId = generateClickId(userId, offerId);

    // Create click record
    const click = new Click({
      clickId,
      userId,
      offerId,
      upi,
      rewardCoins: offer.rewardAmount || 0,
      ipAddress: req.ip,
      deviceInfo: {
        userAgent: req.headers["user-agent"],
        platform: req.headers["sec-ch-ua-platform"],
        timestamp: Date.now(),
      },
      status: "pending",
    });

    await click.save();

    // Return the tracking URL with click ID
    const trackingUrl = offer.trackingUrl.replace("{click_id}", clickId);

    res.status(201).json({
      success: true,
      clickId,
      pcid: clickId, // Adding pcid in response
      trackingUrl,
      message: "Click tracked successfully",
    });
  } catch (error) {
    console.error("Error creating click:", error);
    res.status(500).json({
      success: false,
      message: "Error tracking click",
    });
  }
});

// Handle postback from tracking platform
router.post("/postback", async (req, res) => {
  try {
    const { click_id, pcid, status, offer_id, payout } = req.body;

    // Accept either click_id or pcid
    const clickId = click_id || pcid;

    // Validate required fields
    if (!clickId) {
      return res.status(400).json({
        success: false,
        message: "Click ID (click_id or pcid) is required",
      });
    }

    // Find the click record
    const click = await Click.findOne({ clickId: clickId });

    if (!click) {
      return res.status(404).json({
        success: false,
        message: "Click not found",
      });
    }

    // Verify if the offer matches (if offer_id is provided)
    if (offer_id && click.offerId.toString() !== offer_id) {
      return res.status(400).json({
        success: false,
        message: "Offer ID mismatch",
      });
    }

    // Check if click is already rewarded
    if (click.isRewarded) {
      return res.status(400).json({
        success: false,
        message: "Click already rewarded",
      });
    }

    // Update click status
    const newStatus = status || "installed";
    click.status = newStatus;

    if (newStatus === "installed" || newStatus === "completed") {
      click.isRewarded = true;
      click.rewardedAt = new Date();

      // Update user's coins
      const updateResult = await User.findByIdAndUpdate(
        click.userId,
        {
          $inc: { coins: click.rewardCoins },
        },
        { new: true }
      );

      if (!updateResult) {
        throw new Error("Failed to update user coins");
      }

      // Emit socket event if available
      const io = req.app.get("io");
      if (io) {
        io.to(click.userId.toString()).emit("offerCompleted", {
          clickId: click.clickId,
          rewardCoins: click.rewardCoins,
        });
      }
    }

    await click.save();

    res.json({
      success: true,
      message: "Postback processed successfully",
      status: newStatus,
      isRewarded: click.isRewarded,
      click_id: clickId,
      pcid: clickId, // Always include both formats in response
    });
  } catch (error) {
    console.error("Error processing postback:", error);
    res.status(500).json({
      success: false,
      message: "Error processing postback",
    });
  }
});

// Get click status
router.get("/:clickId", async (req, res) => {
  try {
    const { clickId } = req.params;
    const click = await Click.findOne({ clickId })
      .populate("userId", "name email")
      .populate("offerId", "title rewardAmount trackingUrl");

    if (!click) {
      return res.status(404).json({
        success: false,
        message: "Click not found",
      });
    }

    res.json({
      success: true,
      click,
    });
  } catch (error) {
    console.error("Error fetching click:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching click details",
    });
  }
});

// Get user's clicks with detailed status
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const clicks = await Click.find(query)
      .populate("offerId", "title rewardAmount trackingUrl")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      clicks,
      total: clicks.length,
    });
  } catch (error) {
    console.error("Error fetching user clicks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user clicks",
    });
  }
});

module.exports = router;
