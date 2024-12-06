import mongoose, { mongo } from "mongoose";

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userEmail: {
        type: String,
        required: true,
    },
    userType: {
        type: String,
        enum: ["space-owner", "space-user"]
    },
    currentBalance: {
        type: Number,
        default: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    },
    totalEarned: {
        type: Number,
        default: 0
    },
    allTimeFunding: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet
