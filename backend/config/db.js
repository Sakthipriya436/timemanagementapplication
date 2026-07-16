import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  const fallbackUri = 'mongodb://127.0.0.1:27017/taskmanager';
  const connectionString = uri || fallbackUri;

  console.log(`Connecting to MongoDB URI: ${connectionString}...`);
  if (!uri) {
    console.warn('⚠️ WARNING: No MONGODB_URI found in environment variables. Falling back to local MongoDB.');
    console.warn('💡 TIP: To use MongoDB Atlas, configure your MONGODB_URI in the "backend/.env" file.');
  }

  try {
    await mongoose.connect(connectionString);
    console.log('🎉 MongoDB connected successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB. Error:', err.message);
    console.error('👉 Please make sure local MongoDB is running OR that your MONGODB_URI in "backend/.env" is correct.');
    console.error('👉 Check if your IP address is whitelisted in MongoDB Atlas Network Access.');
    process.exit(1);
  }
};
