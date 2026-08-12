import mongoose from "mongoose"; 

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, default: 'https://ui-avatars.com/api/?background=F84565&color=fff&name=U' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;