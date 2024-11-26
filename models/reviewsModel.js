import mongoose from "mongoose";

// Review schema
const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    },
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing'
    },
    starValue: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, "Only values between 1 - 5 is allowed"]
    },
    title: {
        type: String
    },
    userExperience: {
        type: String,
    },
    stayPeriod: {
        type: String,  // YYYY-MM-DD format
        required: [true, "only dates in this format YYYY-MM-DD is allowed"],
        validate: {
          validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),  // Validate the date format
          message: props => `${props.value} is not a valid date!`
        }
      },
    cleanliness: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    accuracy: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    value: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    service: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    facilities: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    location: {
        type: Number,
        min: 1,
        max: 10,
        default: 10,
        required: [true, "Only numbers between 1 - 10 is allowed"]
    },
    reviewImages: [
        {
            secure_url: {
                type: String,
                required: true
            },
            public_id: {
                type: String,
                required: true
            }
        }
    ],
    reviewCertification: {
        type: Boolean, 
        default: true,
        required: true
    },
    totalReviewLikes: {
        type: Number,
        default: 0,
    },
    totalReviewDislikes: {
        type: Number,
        default: 0
    },
    usersWhoLiked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    usersWhoDisliked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
