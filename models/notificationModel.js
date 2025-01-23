import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Listing',
    },

    title: {
        type: String,
        required: true
    },
    subTitle: {
        type: String,
        required: true 
    },
    displayImage: {
        type: String
    },
    notificationStatus: {
        type: String,
        enum: ["read", "unread"],
        required: true,
        default: "read",
    }
},{
    timestamps : true
})

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;