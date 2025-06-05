const mongoose = require("mongoose");
const User = require("../models/User");
const dotenv = require("dotenv");

dotenv.config();

const resetCheckIns = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/rewards_app"
    );
    console.log("Connected to MongoDB");

    // Reset lastCheckIn for all users
    const result = await User.updateMany(
      {}, // Match all users
      { $set: { lastCheckIn: null } } // Reset lastCheckIn to null
    );

    console.log(`Reset check-ins for ${result.modifiedCount} users`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error resetting check-ins:", error);
    process.exit(1);
  }
};

// If running directly (not imported as a module)
if (require.main === module) {
  resetCheckIns();
}

module.exports = resetCheckIns;
