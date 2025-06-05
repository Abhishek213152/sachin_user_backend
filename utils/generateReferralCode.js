/**
 * Generates a unique referral code based on user's name and random characters
 * @param {string} name - The user's name
 * @returns {string} A referral code
 */
const generateReferralCode = (name) => {
  // Extract first 3 characters from name (or less if name is shorter)
  const namePrefix = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();

  // Generate 4 random alphanumeric characters
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomChars = "";

  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomChars += characters.charAt(randomIndex);
  }

  // Add a timestamp component (last 3 digits of current timestamp)
  const timestamp = Date.now().toString().slice(-3);

  // Combine all components to create the referral code
  return `${namePrefix}${randomChars}${timestamp}`;
};

module.exports = generateReferralCode;
