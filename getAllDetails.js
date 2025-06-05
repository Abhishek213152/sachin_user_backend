const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Click = require("./models/Click");
const User = require("./models/User");
const Offer = require("./models/Offer");

// Load environment variables
dotenv.config();

// MongoDB Connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/rewards_app";

async function getOfferDetails(offerId) {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) {
      console.log("Offer not found!");
      return;
    }

    // Get all clicks for this offer
    const clicks = await Click.find({ offerId }).populate(
      "userId",
      "name email uid"
    );

    // Print offer details
    console.log("\n\x1b[36m=== Offer Details ===\x1b[0m");
    console.log("Title:", offer.title);
    console.log("Description:", offer.description);
    console.log("Coins:", offer.coins);
    console.log("Type:", offer.type);
    console.log("Category:", offer.category);
    console.log("Status:", offer.isActive ? "Active" : "Inactive");
    console.log("Tracking URL:", offer.trackingUrl);

    // Print click statistics
    console.log("\n\x1b[36m=== Click Statistics ===\x1b[0m");
    console.log("Total Clicks:", clicks.length);

    // Count clicks by status
    const statusCounts = clicks.reduce((acc, click) => {
      acc[click.status] = (acc[click.status] || 0) + 1;
      return acc;
    }, {});

    console.log("\nStatus Breakdown:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

    // Print detailed click information
    console.log("\n\x1b[36m=== Click Details ===\x1b[0m");
    clicks.forEach((click, index) => {
      console.log(`\n\x1b[33mClick #${index + 1}\x1b[0m`);
      console.log("Click ID:", click.clickId);
      console.log("User Name:", click.userId.name);
      console.log("User Email:", click.userId.email);
      console.log("User Firebase UID:", click.userId.uid);
      console.log("UPI ID:", click.upi);
      console.log("Status:", click.status);
      console.log("Created At:", new Date(click.createdAt).toLocaleString());
      console.log("Updated At:", new Date(click.updatedAt).toLocaleString());
      if (click.isRewarded) {
        console.log("Rewarded:", click.isRewarded);
        console.log(
          "Rewarded At:",
          click.rewardedAt ? new Date(click.rewardedAt).toLocaleString() : "N/A"
        );
        console.log("Reward Amount:", click.rewardCoins);
      }
      if (click.deviceInfo) {
        console.log("Device Info:", click.deviceInfo);
      }
      console.log("IP Address:", click.ipAddress);
    });

    // Print reward statistics
    const rewardedClicks = clicks.filter((click) => click.isRewarded);
    const totalRewards = rewardedClicks.reduce(
      (sum, click) => sum + (click.rewardCoins || 0),
      0
    );

    console.log("\n\x1b[36m=== Reward Statistics ===\x1b[0m");
    console.log("Total Rewarded Clicks:", rewardedClicks.length);
    console.log("Total Rewards Given:", totalRewards, "coins");

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Check if offer ID is provided as command line argument
const offerId = process.argv[2];
if (!offerId) {
  console.log("Please provide an offer ID as command line argument");
  process.exit(1);
}

// Run the function
getOfferDetails(offerId);
