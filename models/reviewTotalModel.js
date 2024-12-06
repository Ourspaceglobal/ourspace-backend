import mongoose from 'mongoose';

const reviewStatsSchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true,
        unique: true
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    totalStarRating: {
        type: Number,
        default: 0
    },
    totalCleanliness: {
        type: Number,
        default: 0
    },
    totalAccuracy: {
        type: Number,
        default: 0
    },
    totalValue: {
        type: Number,
        default: 0
    },
    totalService: {
        type: Number,
        default: 0
    },
    totalFacilities: {
        type: Number,
        default: 0
    },
    totalLocation: {
        type: Number,
        default: 0
    }
}, {
    timstamps: true
});

const ReviewStats = mongoose.model('ReviewStats', reviewStatsSchema);

export default ReviewStats;
