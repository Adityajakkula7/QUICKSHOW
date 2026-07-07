import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        });
        isConnected = true;
        console.log('DB Connected');
    } catch (error) {
        console.log('DB Connection Error:', error.message);
    }
}

export default connectDB;