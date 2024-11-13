import asyncHandler from "../middleware/asyncHandler.js"
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import Booking from "../models/bookingModel.js"
import Message from "../models/messageModel.js"
import Listing from "../models/listingModel.js";
import DraftListing from "../models/draftListingModel.js";
import { formatBookedDays } from "../utils/helperFunction.js";


const getSpaceUserDashboard = asyncHandler(async (req, res) => {
    console.log("Getting space user dashboard".yellow);

    const userId = req.user._id;

    try {
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        if(user.userType !== "space-user") {
            console.log("Only space users are allowed".red)
            res.status(403).json({
                success: false,
                message: "Only space users are allowed"
            })
        }

        // Fetch notifications and exclude unwanted fields from listing
        const notifications = await Notification.find({ user: userId })
            .populate({
                path: 'listing',
                select: '_id',  // Exclude the entire listing object except for the populated fields
                populate: {
                    path: 'user',
                    select: 'profilePic',  // Only return the user's profilePic
                }
            });

        // Format notifications to include only the profilePic and other necessary fields
        const formattedNotifications = notifications.map(notification => ({
            ...notification._doc,
            displayImage: notification?.listing?.user?.profilePic?.url || 'default-profile-pic-url',
        }));

        // Fetch upcoming bookings as before
        const upcomingBookings = await Booking.find({
            user: userId,
            paymentStatus: "completed"
        })
        .populate({
            path: 'listing',
            select: 'propertyId propertyName propertyLocation livingRoomPictures',
        }).sort({createdAt: -1 });

        const formattedUpcomings = upcomingBookings.map(upcoming => {
            const livingRoomPictures = upcoming.listing.livingRoomPictures;
            return {
                propertyName: upcoming.listing.propertyName,
                bookingStatus: upcoming.bookingStatus,
                status: "Booking successful",
                apartmentNumber: upcoming.listing.propertyLocation.apartmentNumber,
                propertyImage: livingRoomPictures?.length > 0 
                    ? livingRoomPictures[0].secure_url 
                    : 'default-image-url',
                timestamp: upcoming.createdAt,
            };
        });

        res.status(200).json({ 
            success: true,
            message: "Dashboard successfully retrieved",
            data: {
                user,
                notifications: formattedNotifications,
                upcomingBookings: formattedUpcomings,
            },
        });

    } catch (error) {
        console.error('Error fetching user dashboard:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the user dashboard',
            error: error.message,
        });
    }
});

const getAllSUBookings = asyncHandler(async (req, res) => {
    console.log("Getting all space user bookings".yellow);

    const user = req.user;
    const { bookingStatus } = req.query;

    if(user.userType !== "space-user"){
        console.log("Only space users are allowed".red)
        res.status(401).json({
            success: false,
            message: "Only space users are allowed"
        })
    }

    const allowedStatuses = ["awaiting-payment", 'upcoming', 'in-progress', 'completed', 'cancelled'];

    if (bookingStatus && !allowedStatuses.includes(bookingStatus)) {
        console.log(`Invalid bookingStatus. Allowed values are: ${allowedStatuses.join(', ')}.`.red);
        return res.status(400).json({
            success: false,
            message: `Invalid bookingStatus. Allowed values are: ${allowedStatuses.join(', ')}.`,
        });
    }

    // Set initial filter for user and successful payment status
    let filter = { user };

    // Add bookingStatus to the filter if it's provided in the query
    if (bookingStatus) {
        filter.bookingStatus = bookingStatus;
    }

    const currentDate = new Date().toISOString().split('T')[0];

    // Fetch bookings with the filter applied
    let bookings = await Booking.find(filter)
        .populate({
            path: 'listing',
            select: 'propertyId propertyName propertyLocation livingRoomPictures chargePerNight bedroomTotal totalGuestsAllowed bedTotal bathroomTotal description arrivalDepartureDetails',
        });

    if (bookings.length < 1) {
        console.log("Total of 0 bookings found".red);
        return res.status(200).json({
            success: true,
            message: "You currently have no bookings at the moment, checkout some nice apartments nearby, make payment for the one of your choice, and enjoy a seamless stay",
            data: []    
        });
    }

    // Iterate over bookings and update status
    for (let booking of bookings) {
        const firstBookedDay = booking.bookedDays[0];
        const lastBookedDay = booking.bookedDays[booking.bookedDays.length - 1];

        if (currentDate < firstBookedDay) {
            // Booking is in the future
            booking.bookingStatus = 'upcoming';
        } else if (currentDate >= firstBookedDay && currentDate <= lastBookedDay) {
            // Booking is currently in-progress
            booking.bookingStatus = 'in-progress';
        } else if (currentDate > lastBookedDay) {
            // Booking is completed
            booking.bookingStatus = 'completed';
        }

        await booking.save(); // Save the updated status
    }

    // Format bookings data for response
    const formattedBookings = bookings.map(booking => {
        const formattedBookedDays = formatBookedDays(booking.bookedDays);
        
        return {
            id: booking.listing._id, 
            email: req.user.email,
            propertyId: booking.listing.propertyId,
            paymentStatus: booking.paymentStatus,
            propertyName: booking.listing.propertyName,
            bookedDays: formattedBookedDays,
            totalNights: booking.bookedDays.length,
            totalGuests: booking.totalGuest,
            checkIn: `${booking.listing.arrivalDepartureDetails.checkIn.from} - ${booking.listing.arrivalDepartureDetails.checkIn.to}`,
            checkOut: `${booking.listing.arrivalDepartureDetails.checkOut.from} - ${booking.listing.arrivalDepartureDetails.checkOut.to}`,
            propertyLocation: booking.listing.propertyLocation,
            bookingStatus: booking.bookingStatus,
            chargePerNight: booking.listing.chargePerNight,
            bedroomTotal: booking.listing.bedroomTotal,
            totalBeds: booking.listing.bedTotal,
            totalBathroom: booking.listing.bathroomTotal,
            description: booking.listing.description,
            propertyImage: booking.listing.livingRoomPictures[0],
            timestamp: booking.createdAt,
        };
    });
    

    console.log(`Total of ${bookings.length} bookings found`.magenta);
    return res.status(200).json({
        success: true,
        total: bookings.length,
        message: `Total of ${bookings.length} bookings found`,
        data: formattedBookings,
    });
});

const getSUBookingHistory = asyncHandler(async (req, res) => {
    console.log("Getting all space user booking history".yellow);

    const user = req.user;

    const { paystackPaymentStatus } = req.query;

    const allowedStatuses = ['pending', 'success', 'failed'];

    if (paystackPaymentStatus && !allowedStatuses.includes(paystackPaymentStatus)) {
        console.log(`Invalid paystackPaymentStatus. Allowed values are: ${allowedStatuses.join(', ')}.`.red);
        return res.status(400).json({
            success: false,
            message: `Invalid paystackPaymentStatus. Allowed values are: ${allowedStatuses.join(', ')}.`,
        });
    }

    let filter = { user };

    if (paystackPaymentStatus) {
        filter.paystackPaymentStatus = paystackPaymentStatus;
    }

    const bookings = await Booking.find(filter)
        .populate({
            path: 'listing',
            select: 'propertyName livingRoomPictures',
        });

    if (bookings.length < 1) {
        console.log("Total of 0 bookings found".red);
        return res.status(200).json({
            success: true,
            message: "You currently have no bvookings at the moment, checkout some nice apartment closeby, make payment for the one of your choice and enjoy seamless stay",
            data: []
        });
    }

    const formattedBookings = bookings.map(booking => ({
        livingRoomPictures: booking.listing.livingRoomPictures[0],
        propertyName: booking.listing.propertyName,
        timestamp: booking.createdAt,
        amountPaid: booking.amount,
        paystackPaymentStatus: booking.paystackPaymentStatus,
    }));
    
    console.log(`Total of ${bookings.length} booking history found`.magenta);
    return res.status(200).json({
        success: true,
        message: `Total of ${bookings.length} booking history found`,
        data: formattedBookings,
    });
});

const getAllNotifications = asyncHandler(async(req, res)=> {
    console.log("getting all notifications for user ".yellow)

    const user = req.user

    if(!user) {
        console.log("User not found".red)
        return res.status(400).json({
            success: false,
            message: "User not found"
        })
    }

    try {

        const notifications = await Notification.find({user})

        if(notifications.length < 1) {
            console.log("Total of 0 notifications found".red)
            return res.status(200).json({
                success: true,
                message: "Total of 0 notificatons found"
            })
        }

        console.log(`Total of ${notifications.length} found`.red)
        return res.status(200).json({
            success: true,
            message: `Total of ${notifications.length} found`,
            data: notifications
        })
        
    } catch (error) {
        console.log("Error gettingnotifications", error)
        res.status(400).json({
            success: false,
            message: "Error gettingnotifications", error
        })
    }
})
 
//                                                              space owners
const getSpaceOwnerDashboard = asyncHandler(async (req, res) => {
    console.log("Getting space owner dashboard".yellow);

    const userId = req.user;

    try {
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const listings = await Listing.find({ user: userId });
        const draftListings = await DraftListing.find({ user: userId });

        const currentDate = new Date().toISOString().split('T')[0];

        const activeBookings = await Booking.find({
            listing: { $in: listings.map(listing => listing._id) },
            paystackPaymentStatus: 'success',
            bookedDays: currentDate,
        });

        const uniqueUserIds = [...new Set(activeBookings.map(booking => booking.user.toString()))];
        const currentSpaceUsers = uniqueUserIds.length;

        const messages = await Message.find({ receiver: userId })
            .populate({
                path: 'sender', 
                select: 'profilePicture firstName lastName',
            })
            .populate({
                path: 'listing', 
                select: 'propertyName',
            })
            .sort({ timestamp: -1 });

        const formattedMessages = messages.map(message => ({
            senderProfilePicture: message.sender.profilePicture || 'default-profile-url',
            senderName: `${message.sender.firstName} ${message.sender.lastName}`,
            propertyName: message.listing ? message.listing.propertyName : 'Unknown Property',
            latestMessage: message.content,
            sentAt: message.timestamp,
        }));

        const allTotalListings = listings.length + draftListings.length

        res.status(200).json({
            success: true,
            message: "Dashboard successfully retrieved",
            data: {
                totalListings: allTotalListings,
                currentSpaceUsers,
                messages: formattedMessages,
            },
        });

    } catch (error) {
        console.error('Error fetching user dashboard:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the user dashboard',
            error: error.message,
        });
    }
});



const format = asyncHandler(async(req, res)=> {
    console.log("getting all space user bookings".yellow)
})

const helperLogic = asyncHandler(async (req, res) => {
    console.log("Making use of helper functions".yellow);

    // Retrieve all bookings
    const bookings = await Booking.find();

    if (!bookings || bookings.length === 0) {
        console.log("No booking found".red);
        return res.status(200).json({
            success: true,
            message: "No booking available at the moment",
        });
    }

    try {
        // Update `paymentStatus` to "awaiting-payment" where it's not already set
        for (const booking of bookings) {
            if (booking.paymentStatus !== "awaiting-payment") {
                booking.paymentStatus = "awaiting-payment";
                await booking.save();
            }
        }

        // Update `bookingStatus` to "awaiting-payment" where it's not already set
        for (const booking of bookings) {
            if (booking.bookingStatus !== "awaiting-payment") {
                booking.bookingStatus = "awaiting-payment";
                await booking.save();
            }
        }

        console.log("Helper function executed successfully".green);
        return res.status(200).json({
            success: true,
            message: "Bookings updated to awaiting-payment where applicable",
        });
    } catch (error) {
        console.error("Error updating bookings:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while updating bookings",
            error: error.message,
        });
    }
});




export {
    getSpaceUserDashboard,
    getAllSUBookings,
    getAllNotifications,
    getSUBookingHistory,
    // space owner
    getSpaceOwnerDashboard,


    helperLogic
}