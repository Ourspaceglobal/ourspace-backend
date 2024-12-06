import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import Listing from "../models/listingModel.js";
import Review from "../models/reviewsModel.js";
import ReviewStats from "../models/reviewTotalModel.js";
import cloudinaryConfig from "../uploadUtils/cloudinaryConfig.js";
import Booking from "../models/bookingModel.js";

const uploadReviewImagesToCloudinary = async (files) => {
    const uploadPromises = files.map(file => {
        return cloudinaryConfig.uploader.upload(file.path, {
            folder: 'ourSpace/review-images'
        });
    });

    const uploadedImages = await Promise.all(uploadPromises);

    // Extract secure_url and public_id from the Cloudinary response
    return uploadedImages.map(image => ({
        secure_url: image.secure_url,
        public_id: image.public_id
    }));
};

export const addNewReview = asyncHandler(async (req, res) => {
    console.log("Adding a new review".yellow);

    const user = req.user;
    const userId = req.user._id;

    const { listingId } = req.params; 

    if(!listingId) {
        console.log("Listing Id is required".red)
        return res.status(400).json({
            success: false,
            message: "Listing Id must be provided"
        })
    }

    // I want to find all bookings for this listing wit a progress of completed, and make sure this user trying to make a booking is part 
    const allBookings = await Booking.find({
        listing: listingId,
        bookingStatus: "completed"
    })

    if(!allBookings || allBookings.length === 0) {
        console.log("No booking is available for this listing so no user can add a review".red)
        return res.status(200).json({
            success: true,
            message: "No booking is available for this listing so no user can add a review"
        })
    }

    const userHasCompletedBooking = allBookings.some(booking => {
        console.log(`Checking Booking User: ${booking.user}, Current User: ${userId}`);
        return booking.user.toString() === userId.toString();
    });
    
    if (!userHasCompletedBooking) {
        console.log("Only users who have completed bookings can leave a review.".red);
        return res.status(400).json({
            success: false,
            message: "Only users who have completed bookings can leave a review"
        });
    }

    const {
        starValue, title, userExperience, stayPeriod,
        cleanliness, accuracy, value, service,
        facilities, location, certification
    } = req.body;

    // Trim and normalize certification value
    const normalizedCertification = typeof certification === "string" ? certification.trim().toLowerCase() : certification;

    console.log("Normalized certification: ", normalizedCertification);

    // Validate certification explicitly
    const reviewCertification = normalizedCertification === "true" || normalizedCertification === true ? true : undefined;

    console.log("Review Certification: ", reviewCertification);

    if (!reviewCertification) {
        return res.status(400).json({
            success: false,
            message: "Review certification must be true to submit a review.",
        });
    }

    let session;
    let uploadedPublicIds = []; 

    try {
        session = await mongoose.startSession();
        session.startTransaction();

        let reviewImages = [];
        if (req.files && req.files.length > 0) {
            console.log("Uploading review images".grey);
            const uploadedImages = await uploadReviewImagesToCloudinary(req.files);
            reviewImages = uploadedImages;
            uploadedPublicIds = uploadedImages.map(img => img.public_id);
        }

        const review = await Review.create([{
            listing: listingId,
            user: userId,
            starValue: parseFloat(starValue.trim()),
            title: title.trim(),
            userExperience: userExperience.trim(),
            stayPeriod,
            cleanliness: parseFloat(cleanliness.trim()),
            accuracy: parseFloat(accuracy.trim()),
            value: parseFloat(value.trim()),
            service: parseFloat(service.trim()),
            facilities: parseFloat(facilities.trim()),
            location: parseFloat(location.trim()),
            reviewImages,
            reviewCertification
        }], { session });

        let reviewStats = await ReviewStats.findOne({ listing: listingId }).session(session);

        if (!reviewStats) {
            reviewStats = new ReviewStats({
                listing: listingId,
                totalReviews: 0,
                totalStarRating: 0,
                totalCleanliness: 0,
                totalAccuracy: 0,
                totalValue: 0,
                totalService: 0,
                totalFacilities: 0,
                totalLocation: 0
            });
        }

        reviewStats.totalReviews += 1;

        // Helper function to round to 2 decimal places
        const roundToTwo = (num) => Math.round(num * 100) / 100;

        reviewStats.totalStarRating = roundToTwo(
        ((reviewStats.totalStarRating * (reviewStats.totalReviews - 1)) + parseFloat(starValue.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalCleanliness = roundToTwo(
        ((reviewStats.totalCleanliness * (reviewStats.totalReviews - 1)) + parseFloat(cleanliness.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalAccuracy = roundToTwo(
        ((reviewStats.totalAccuracy * (reviewStats.totalReviews - 1)) + parseFloat(accuracy.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalValue = roundToTwo(
        ((reviewStats.totalValue * (reviewStats.totalReviews - 1)) + parseFloat(value.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalService = roundToTwo(
        ((reviewStats.totalService * (reviewStats.totalReviews - 1)) + parseFloat(service.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalFacilities = roundToTwo(
        ((reviewStats.totalFacilities * (reviewStats.totalReviews - 1)) + parseFloat(facilities.trim())) / reviewStats.totalReviews
        );
        reviewStats.totalLocation = roundToTwo(
        ((reviewStats.totalLocation * (reviewStats.totalReviews - 1)) + parseFloat(location.trim())) / reviewStats.totalReviews
        );

        await reviewStats.save({ session });
        await session.commitTransaction();
        session.endSession();

        console.log("Review and review statistics updated successfully".magenta);
        res.status(201).json({
            success: true,
            message: "Your review has successfully been submitted",
            data: review
        });
    } catch (error) {
        if (session) await session.abortTransaction();
        console.log("Transaction aborted. Cleaning up uploaded images.".red);

        // Cleanup Cloudinary images
        if (uploadedPublicIds.length > 0) {
            const deletePromises = uploadedPublicIds.map(publicId =>
                cloudinaryConfig.uploader.destroy(publicId)
            );
            await Promise.all(deletePromises); // Wait for all deletions to complete
            console.log("Uploaded images deleted from Cloudinary.".green);
        }

        console.log("Error", error.message);
        res.status(400).json({
            success: false,
            message: "Error encountered while submitting review",
            error
        });
    }
});

// Post ------ LIKE A REVIEW
// api/v1/reviews/like-review
// Protect
export const likeOrDislikeReview = asyncHandler(async (req, res) => {
    console.log("User updating a review reaction".cyan);

    const { listingId } = req.params;
    const { reviewId, likeOrDislike } = req.body;
    const userId = req.user._id; 

    console.log("Listing: ", listingId)
    console.log("review Id: ", reviewId)
    console.log("like or dislike: ", likeOrDislike)

    // Validate inputs
    if (!listingId || !reviewId || !likeOrDislike) {
        console.log("Listing Id, review Id, and likeOrDislike are required".red);
        return res.status(400).json({
            success: false,
            message: "Listing Id, review Id, and likeOrDislike are required",
        });
    }

    if (!["like", "dislike"].includes(likeOrDislike)) {
        console.log("Invalid value for likeOrDislike".red);
        return res.status(400).json({
            success: false,
            message: "likeOrDislike must be either 'like' or 'dislike'",
        });
    }

    // Check if IDs are valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(listingId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
        console.log("Invalid listing or review Id".red);
        return res.status(400).json({
            success: false,
            message: "Invalid listing or review Id",
        });
    }

    try {
        // Find the listing
        const existingListing = await Listing.findById(listingId);
        if (!existingListing) {
            console.log("Listing cannot be found or does not exist".red);
            return res.status(404).json({
                success: false,
                message: "Listing cannot be found or does not exist",
            });
        }

        // Find the review
        const existingReview = await Review.findById(reviewId);
        if (!existingReview) {
            console.log("Review cannot be found or does not exist".red);
            return res.status(404).json({
                success: false,
                message: "Review cannot be found or does not exist",
            });
        }

        // Handle "like" action
        if (likeOrDislike === "like") {
            // Remove from dislike if previously disliked
            if (existingReview.usersWhoDisliked.includes(userId)) {
                existingReview.usersWhoDisliked = existingReview.usersWhoDisliked.filter(
                    (id) => id.toString() !== userId.toString()
                );
                existingReview.totalReviewDislikes -= 1;
            }

            // Add to likes if not already liked
            if (!existingReview.usersWhoLiked.includes(userId)) {
                existingReview.usersWhoLiked.push(userId);
                existingReview.totalReviewLikes += 1;
            } else {
                console.log("User has already liked this review.".red);
                return res.status(400).json({
                    success: false,
                    message: "You have already liked this review",
                });
            }
        }

        // Handle "dislike" action
        if (likeOrDislike === "dislike") {
            // Remove from likes if previously liked
            if (existingReview.usersWhoLiked.includes(userId)) {
                existingReview.usersWhoLiked = existingReview.usersWhoLiked.filter(
                    (id) => id.toString() !== userId.toString()
                );
                existingReview.totalReviewLikes -= 1;
            }

            // Add to dislikes if not already disliked
            if (!existingReview.usersWhoDisliked.includes(userId)) {
                existingReview.usersWhoDisliked.push(userId);
                existingReview.totalReviewDislikes += 1;
            } else {
                console.log("User has already disliked this review.".red);
                return res.status(400).json({
                    success: false,
                    message: "You have already disliked this review",
                });
            }
        }

        // Save the updated review
        await existingReview.save();

        console.log(
            `Review updated successfully! \nTotal likes: ${existingReview.totalReviewLikes}\nTotal dislikes: ${existingReview.totalReviewDislikes}`.green
        );

        return res.status(200).json({
            success: true,
            message: `Review ${likeOrDislike}d successfully`,
            data: existingReview,
        });
    } catch (error) {
        console.log("Error updating review reaction", error.red);
        return res.status(500).json({
            success: false,
            message: "Error updating review reaction",
            error: error.message || error,
        });
    }
});
