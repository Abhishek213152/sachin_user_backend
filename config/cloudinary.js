const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

// Make sure environment variables are loaded
dotenv.config();

// Log the environment variables to debug
console.log('Cloudinary Environment Variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '****' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'undefined');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '****' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'undefined');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

module.exports = cloudinary; 