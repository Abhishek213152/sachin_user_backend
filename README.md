# User Backend API

This is the backend API for the User app.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Set up your environment variables. Make a copy of `.env.example` as `.env` and update the values:

   ```
   cp .env.example .env
   ```

3. Set up Cloudinary for profile image storage:

   a. Create a free account at [Cloudinary](https://cloudinary.com/users/register/free)

   b. Once registered, go to your Cloudinary dashboard to get your credentials:

   - Cloud name
   - API Key
   - API Secret

   c. Update your `.env` file with these credentials:

   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. Start the server:
   ```
   npm start
   ```

## API Endpoints

### User Profile Image Upload

**POST** `/api/users/profile-image/:uid`

Uploads a profile image to Cloudinary and saves the URL in MongoDB.

- Request Body:

  ```json
  {
    "imageData": "base64 encoded image string"
  }
  ```

- Response:
  ```json
  {
    "success": true,
    "message": "Profile image updated successfully",
    "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/..."
  }
  ```

## Testing

You can test the Cloudinary upload by using the Profile screen in the app. When you upload a profile picture, it will:

1. Send the image to the backend API
2. Upload to Cloudinary
3. Store only the URL in MongoDB (not the actual image)
4. Return the URL to the frontend
5. Display the image from Cloudinary's CDN
# sachin_user_backend
