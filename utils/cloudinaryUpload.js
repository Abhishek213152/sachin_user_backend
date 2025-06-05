const cloudinary = require("../config/cloudinary");

/**
 * Upload an image to Cloudinary
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} publicIdPrefix - Prefix for the public_id (e.g., 'user' or 'offer')
 * @param {string} folder - Folder to store image in (defaults to 'profile_images')
 * @returns {Promise<Object>} - Cloudinary upload response
 */
const uploadImage = async (
  base64Image,
  publicIdPrefix,
  folder = "profile_images"
) => {
  try {
    // Remove data:image/jpeg;base64, prefix if present
    const imageData = base64Image.includes("base64,")
      ? base64Image.split("base64,")[1]
      : base64Image;

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageData}`,
      {
        folder: folder,
        public_id: `${publicIdPrefix}_${Date.now()}`,
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 500, height: 500, crop: "limit" },
          { quality: "auto" },
        ],
      }
    );

    console.log(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

module.exports = { uploadImage };
