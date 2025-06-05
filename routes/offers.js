const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");
const User = require("../models/User");
const { uploadImage } = require("../utils/cloudinaryUpload");

// Get all active offers
router.get("/", async (req, res) => {
  try {
    const offers = await Offer.find({ isActive: true });
    res.json(offers);
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get offers by type
router.get("/type/:type", async (req, res) => {
  try {
    const offers = await Offer.find({
      type: req.params.type,
      isActive: true,
    });
    res.json(offers);
  } catch (error) {
    console.error("Error fetching offers by type:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Complete an offer
router.post("/:offerId/complete/:firebaseUid", async (req, res) => {
  try {
    const { offerId, firebaseUid } = req.params;

    // Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (!offer.isActive) {
      return res.status(400).json({ message: "Offer is not active" });
    }

    // Find the user and check if they exist
    const existingUser = await User.findOne({ uid: firebaseUid });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has already completed this offer
    if (existingUser.completedOffers.includes(offerId)) {
      return res.status(400).json({ message: "Offer already completed" });
    }

    // Create transaction record
    const transaction = {
      id: Date.now().toString(),
      type: "earn",
      amount: offer.coins,
      description: `Completed offer: ${offer.title}`,
      offerId: offerId,
      date: new Date(),
    };

    // Create notification
    const notification = {
      id: Date.now().toString() + "_complete",
      title: "Offer Completed Successfully!",
      message: `Congratulations! Your offer "${offer.title}" has been verified and completed. You earned ${offer.coins} coins!`,
      type: "reward",
      read: false,
      timestamp: Date.now(),
    };

    // Update user document using findOneAndUpdate
    const updatedUser = await User.findOneAndUpdate(
      { uid: firebaseUid },
      {
        $inc: { coins: offer.coins },
        $push: {
          completedOffers: offerId,
          transactions: { $each: [transaction], $position: 0 },
          notifications: { $each: [notification], $position: 0 },
        },
        $pull: {
          pendingOffers: offerId,
          rejectedOffers: offerId,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Failed to update user" });
    }

    // Update offer's completedBy list
    await Offer.findByIdAndUpdate(
      offerId,
      {
        $push: { completedBy: firebaseUid },
      },
      { new: true }
    );

    res.json({
      message: "Offer completed successfully",
      coins: updatedUser.coins,
      transaction,
      notification,
    });
  } catch (error) {
    console.error("Error completing offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get completed offers for a user
router.get("/completed/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const completedOffers = await Offer.find({
      _id: { $in: user.completedOffers },
    });

    res.json(completedOffers);
  } catch (error) {
    console.error("Error fetching completed offers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create offer (for admin purposes)
router.post("/", async (req, res) => {
  try {
    const { title, description, coins, type, requirements, imageData } =
      req.body;

    if (!title || !description || !coins || !type || !requirements) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let imageUrl = req.body.image; // Default to the provided image URL

    // If imageData is provided, upload to Cloudinary
    if (imageData) {
      try {
        const uploadResult = await uploadImage(
          imageData,
          "offer",
          "offer_images"
        );
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          error: "Image upload failed",
          message:
            uploadError.message || "Failed to upload image to cloud storage",
        });
      }
    }

    const offer = new Offer({
      title,
      description,
      coins,
      type,
      requirements,
      image: imageUrl,
      developer: req.body.developer || "",
      rating: req.body.rating || 4.0,
      downloads: req.body.downloads || "",
      category: req.body.category || "",
      appLink: req.body.appLink || "",
      trackingUrl: req.body.trackingUrl || "",
      deadline: req.body.deadline || "7 days",
      steps: req.body.steps || [],
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      offerCategory: req.body.offerCategory || "regular",
      expiryDate: req.body.expiryDate || null,
    });

    await offer.save();
    res.status(201).json(offer);
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Also update the PUT route to handle image uploads
router.put("/:id", async (req, res) => {
  try {
    const {
      title,
      description,
      coins,
      type,
      requirements,
      imageData,
      trackingUrl,
    } = req.body;

    if (!title || !description || !coins || !type || !requirements) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let imageUrl = req.body.image; // Default to the provided image URL

    // If imageData is provided, upload to Cloudinary
    if (imageData) {
      try {
        const uploadResult = await uploadImage(
          imageData,
          "offer",
          "offer_images"
        );
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          error: "Image upload failed",
          message:
            uploadError.message || "Failed to upload image to cloud storage",
        });
      }
    }

    const updatedOfferData = {
      title,
      description,
      coins,
      type,
      requirements,
      image: imageUrl,
      developer: req.body.developer || "",
      rating: req.body.rating || 4.0,
      downloads: req.body.downloads || "",
      category: req.body.category || "",
      appLink: req.body.appLink || "",
      trackingUrl: trackingUrl, // Use the trackingUrl directly from req.body
      deadline: req.body.deadline || "7 days",
      steps: req.body.steps || [],
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      offerCategory: req.body.offerCategory || "regular",
      expiryDate: req.body.expiryDate || null,
    };

    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      updatedOfferData,
      {
        new: true,
      }
    );

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    res.json(offer);
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Mark an offer as pending for a user
router.post("/:offerId/pending/:firebaseUid", async (req, res) => {
  try {
    const { offerId, firebaseUid } = req.params;

    // Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (!offer.isActive) {
      return res.status(400).json({ message: "Offer is not active" });
    }

    // Find the user and check if they exist
    const existingUser = await User.findOne({ uid: firebaseUid });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has already completed this offer
    if (existingUser.completedOffers.includes(offerId)) {
      return res.status(400).json({ message: "Offer already completed" });
    }

    // Check if offer is already in pending list
    if (existingUser.pendingOffers.includes(offerId)) {
      return res.status(400).json({ message: "Offer is already pending" });
    }

    // Create notification
    const notification = {
      id: Date.now().toString(),
      title: "Offer Submitted for Verification",
      message: `Your offer "${offer.title}" has been submitted for verification. We'll notify you once it's reviewed.`,
      type: "offer",
      read: false,
      timestamp: Date.now(),
    };

    // Update user document using findOneAndUpdate
    const updatedUser = await User.findOneAndUpdate(
      { uid: firebaseUid },
      {
        $push: {
          pendingOffers: offerId,
          notifications: { $each: [notification], $position: 0 },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Failed to update user" });
    }

    res.json({
      message: "Offer marked as pending",
      pendingOffers: updatedUser.pendingOffers,
      notification: notification,
    });
  } catch (error) {
    console.error("Error marking offer as pending:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get pending offers for a user
router.get("/pending/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pendingOffers = await Offer.find({
      _id: { $in: user.pendingOffers },
    });

    res.json(pendingOffers);
  } catch (error) {
    console.error("Error fetching pending offers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Mark an offer as rejected for a user
router.post("/:offerId/reject/:firebaseUid", async (req, res) => {
  try {
    const { offerId, firebaseUid } = req.params;
    const { reason } = req.body; // Optional rejection reason

    // Find the offer
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Find the user and check if they exist
    const existingUser = await User.findOne({ uid: firebaseUid });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has already completed this offer
    if (existingUser.completedOffers.includes(offerId)) {
      return res.status(400).json({ message: "Offer already completed" });
    }

    // Check if offer is already in rejected list
    if (existingUser.rejectedOffers.includes(offerId)) {
      return res.status(400).json({ message: "Offer is already rejected" });
    }

    // Create notification about offer rejection
    const rejectionReason =
      reason || "The verification requirements were not met.";
    const notification = {
      id: Date.now().toString() + "_reject",
      title: "Offer Verification Unsuccessful",
      message: `Your offer "${offer.title}" was not approved. Reason: ${rejectionReason}`,
      type: "offer",
      read: false,
      timestamp: Date.now(),
    };

    // Update user document using findOneAndUpdate
    const updatedUser = await User.findOneAndUpdate(
      { uid: firebaseUid },
      {
        $push: {
          rejectedOffers: offerId,
          notifications: { $each: [notification], $position: 0 },
        },
        $pull: {
          pendingOffers: offerId,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Failed to update user" });
    }

    res.json({
      message: "Offer marked as rejected",
      rejectedOffers: updatedUser.rejectedOffers,
      notification,
    });
  } catch (error) {
    console.error("Error marking offer as rejected:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get rejected offers for a user
router.get("/rejected/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const rejectedOffers = await Offer.find({
      _id: { $in: user.rejectedOffers },
    });

    res.json(rejectedOffers);
  } catch (error) {
    console.error("Error fetching rejected offers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
