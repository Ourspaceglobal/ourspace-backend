import axios from 'axios';
import asyncHandler from "../middleware/asyncHandler.js";
import Listing from "../models/listingModel.js"
import sendEmail from "../utils/sendMail.js"
import Booking from '../models/bookingModel.js';
import Notification from '../models/notificationModel.js';
import Message from '../models/messageModel.js';
import { sendSuccessfulBookingMailToSpaceOwner, sendSuccessfulPaymentMail } from '../utils/authUtils.js';
import { formatAmount, formatDate, formatDateWithoutTime } from '../utils/helperFunction.js';
import Wallet from '../models/walletModel.js';
import { validateBookingAvailability } from '../utils/availabilityHelper.js';

function generateInvoiceId() {
    const randomDigits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
    return `#${randomDigits}`;
}

export const checkAvailability = asyncHandler(async (req, res) => {
    console.log("Checking availability before booking endpoint...".blue);

    const { listingId } = req.params;
    const { checkIn, checkOut, spaceUsers } = req.body;

    const requiredFields = { listingId, checkIn, checkOut, spaceUsers };
    const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing the following field(s): ${missingFields.join(", ")}`,
        });
    }

    try {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        const result = await validateBookingAvailability({
            listingId,
            checkInDate,
            checkOutDate,
            spaceUsers,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message, conflictDates: result.conflictDates });
        }

        res.status(200).json({
            success: true,
            message: result.message,
            availableDates: result.availableDates,
        });
    } catch (error) {
        console.error(`Error checking availability: ${error.message}`.red);
        res.status(500).json({
            success: false,
            message: "An error occurred while checking availability.",
        });
    }
});

let paystackKey;
if (process.env.NODE_ENV === "development"){
    paystackKey = process.env.PAYSTACK_TEST_SECRET_KEY
} else {
    paystackKey = process.env.PAYSTACK_LIVE_SECRET_KEY
}

export const initializeTransaction = asyncHandler(async (req, res) => {
    console.log("Initializing Paystack payment...".green);

    const userId = req.user._id;

    const {
        email, callBackUrl, listingId, newBookedDays,
        firstName, lastName, phoneNumber, bookingForSomeone, totalGuest, discount
    } = req.body;

    const requiredFields = {
        email,
        callBackUrl,
        listingId,
        newBookedDays,
        firstName,
        lastName,
        phoneNumber,
        totalGuest
    };

    const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        console.log("Missing fields:", missingFields.join(', ').red);
        return res.status(400).json({
            success: false,
            message: `Missing the following field(s): ${missingFields.join(', ')}`
        });
    }

    // Generate booked days excluding the checkout date
    const generateBookedDays = (checkInDate, checkOutDate) => {
        const bookedDays = [];
        let currentDate = new Date(checkInDate);

        // Loop until the day before checkOutDate
        while (currentDate < new Date(checkOutDate)) {
            bookedDays.push(new Date(currentDate).toISOString().split('T')[0]); // Add in YYYY-MM-DD format
            currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }

        return bookedDays;
    };

    // Use newBookedDays from the request to calculate the range
    const checkInDate = new Date(newBookedDays[0]);
    const checkOutDate = new Date(newBookedDays[newBookedDays.length - 1]);

    // Ensure that the bookedDays include all dates within the range except the checkout date
    const uniqueBookedDays = generateBookedDays(checkInDate, checkOutDate);

    // Retrieve listing from database
    const listing = await Listing.findById(listingId).populate('user');

    if (!listing) {
        console.log("Listing not found".red);
        return res.status(404).json({
            success: false,
            message: "Listing not found.",
        });
    }

    // Validate booking availability
    const availabilityCheck = await validateBookingAvailability({
        listingId,
        checkInDate,
        checkOutDate,
        spaceUsers: totalGuest
    });

    if (!availabilityCheck.success) {
        return res.status(400).json({
            success: false,
            message: availabilityCheck.message,
            conflictDates: availabilityCheck.conflictDates || []
        });
    }

    // Calculate transaction details
    const listingCharge = listing.chargePerNight;
    const totalNights = uniqueBookedDays.length;
    const amountIncurred = listingCharge * totalNights;
    const totalAmountIncured = amountIncurred;
    const amountInKobo = totalAmountIncured * 100;

    try {
        // Initialize transaction with Paystack
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amountInKobo,
                first_name: firstName,
                last_name: lastName,
                phone: phoneNumber,
                callback_url: callBackUrl,
            },
            {
                headers: {
                    Authorization: `Bearer ${paystackKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const { authorization_url, access_code, reference } = response.data.data;
        const callBackWithReference = `${callBackUrl}?reference=${reference}`;

        // Save booking in database
        const newBooking = await Booking.create({
            user: userId,
            listing: listingId,
            spaceOwnerId: listing.user._id,
            paymentType: "bank-payment",
            paymentStatus: "awaiting-payment",
            bookingStatus: 'awaiting-payment',
            paystackRef: reference,
            paystackAccessCode: access_code,
            paystackReference: reference,
            paystackPaymentStatus: "pending",
            firstName,
            lastName,
            email,
            phoneNumber,
            bookingForSomeone,
            bookedDays: uniqueBookedDays,
            totalGuest,
            chargePerNight: listingCharge,
            totalNight: totalNights,
            totalIncuredCharge: totalAmountIncured,
            totalIncuredChargeAfterDiscount: totalAmountIncured,
            discount: discount || 0
        });

        console.log("New booking successfully initiated".cyan);
        res.status(200).json({
            success: true,
            message: `New booking successfully initiated`,
            data: {
                authorization_url,
                access_code,
                reference,
                callBackWithReference,
                chargePerNight: listingCharge,
                totalNights: totalNights,
                totalIncuredAmount: totalAmountIncured
            },
        });
    } catch (error) {
        console.error("Error initializing transaction:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize transaction.', error,
        });
    }
});


export const handleWebhook = async (req, res) => {
    const event = req.body;

    // I try to verify if the webhook is valid
    if (event.event === 'charge.success') {
        const { reference } = event.data;
        const { amount, status, email } = event.data.customer;

        // I first find the transaction
        const transaction = await Transaction.findOne({ reference });

        if (transaction && transaction.amount === amount) {
            await Transaction.findOneAndUpdate(
                { reference },
                { status: 'successful' }
            );

            const ourspaceEmail = process.env.OUR_SPACE_EMAIL
            const maximusEmail = process.env.MAXIMUS_EMAIL
            const paymentNotificationEmail = `${ourspaceEmail}, ${maximusEmail}`;
            await sendEmail(
                paymentNotificationEmail,
                "Ourspace bookings payment",
                `A new payment of ${amount / 100} Naira was made by ${email}.`
            )
            console.log("payment confirmed and email sent")

            res.status(200).send('Webhook received and processed');
        } else {
            res.status(400).send('Transaction verification failed');
        }
    } else {
        res.status(400).send('Invalid event type');
    }
};

export const verifyTransaction = asyncHandler(async (req, res) => {
    console.log("Verifying paystack transaction...".green);

    const { reference, listingId } = req.body;
    const userId = req.user;

    const listing = await Listing.findById(listingId).populate('user');

    // Input validation
    if (!reference || !userId || !listingId) {
        console.log("Reference, userId, and listingId fields must be provided");
        return res.status(400).json({
            success: false,
            message: 'Reference, userId, and listingId fields must be provided'
        });
    }

    try {
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${paystackKey}`,
                },
            }
        );

        const { status: paystackStatus, amount: paystackKoboAmount, customer } = response.data.data;

        if (paystackStatus !== 'success') {
            console.log("Payment failed".red);
            return res.status(400).json({
                success: false,
                message: 'Payment was not successful.',
            });
        }

        const booking = await Booking.findOne({ paystackReference: reference }).populate('user').populate('listing');

        if (!booking) {
            console.log("Payment was successful, but the booking was not found".red);
            return res.status(404).json({
                success: false,
                message: 'Payment was successful, but the booking was not found.',
            });
        }

        // if (booking.paystackPaymentStatus === 'success') {
        //     console.log("booking has already been verified as successful".bgRed);
        //     return res.status(400).json({
        //         success: false,
        //         message: 'This booking transaction has already been verified as successful.',
        //     });
        // }

        const amountPaidToPaystack = paystackKoboAmount / 100;

        if (booking.totalIncuredCharge !== amountPaidToPaystack) {
            console.log("Paid amount does not match expected amount.".red)
            return res.status(400).json({
                success: false,
                message: 'Paid amount does not match expected amount.',
            });
        }

        const totalNights = booking.bookedDays
        const totalBookedNights = totalNights.length

        // Step 5: Update the booking's status and generate invoiceId
        booking.paystackPaymentStatus = 'success';
        booking.paymentStatus = 'completed';
        booking.bookingStatus = 'upcoming';
        booking.invoiceId = generateInvoiceId();
        await booking.save();

        if (!booking) {
            console.log("Booking not found".red);
            return res.status(400).json({
                success: false,
                message: "No booking with reference found"
            });
        }

        if(listing) {
            const newBookedDays = booking.bookedDays;
            // console.log("Booked days: ",newBookedDays)
            listing.calendar.bookedDays = [...listing.calendar.bookedDays, ...newBookedDays];
            // Check if the user is already in propertyUsers
            if (!listing.propertyUsers.includes(userId)) {
                listing.propertyUsers.push(userId); 
            }
            
            await listing.save();

            console.log("Transaction verified, listing and booking details updated successfully.".cyan);

            const listingOwner = listing.user;

            console.log("Updating space owner wallet".blue) 

            let spaceOwnerWallet = await Wallet.findOne({ user: listing.user._id });

            // Subtract 10% from the total incurred charge
            const newTotalEarned = booking.totalIncuredChargeAfterDiscount
          
            if (!spaceOwnerWallet) {
                console.log("No wallet info found, creating a new one and adding new booked amount by space user".yellow);
                // If no wallet exists, create a new wallet for the user
                spaceOwnerWallet = new Wallet({
                    user: listing.user._id,
                    userEmail: listing.user.email,
                    userType: listing.user.userType,
                    totalEarned: newTotalEarned,  
                    currentBalance: newTotalEarned, 
                    totalWithdrawn: 0
                });
            } else {
                // Update the existing wallet
                const allTimeEarning = spaceOwnerWallet.totalEarned + newTotalEarned;
                const newCurrentBalance = spaceOwnerWallet.currentBalance + newTotalEarned;

                spaceOwnerWallet.totalEarned = allTimeEarning;
                spaceOwnerWallet.currentBalance = newCurrentBalance;
            }

            await spaceOwnerWallet.save();

            // create a new notification
            await Notification.create({
                user: userId,
                listing: listingId,
                title: listing.propertyName,
                subTitle: `Your payment of ₦${formatAmount(amountPaidToPaystack)} has been confirmed and your booking is successful for ${newBookedDays.length} day(s) at ${listing.propertyName}`,
            });

            console.log("Notification created successfully.".green);

            // Create a new message for the user
            await Message.create({
                sender: listingOwner._id,
                receiver: req.user._id,
                listing: listingId,
                propertyUserId: req.user._id, 
                content: `Your payment of ₦${formatAmount(amountPaidToPaystack)} has been confirmed and your booking is successful for ${newBookedDays.length} day(s) at ${listing.propertyName}`,
            });

            const formattedAmount = formatAmount(amountPaidToPaystack)

            // Send mail to space user
            await sendSuccessfulPaymentMail(
                req.user.email, 
                req.user.firstName, 
                listing.propertyName, 
                totalBookedNights, 
                formattedAmount
            );

            const formattedBookingTotalCharge = formatAmount(booking.totalIncuredCharge)
    
            // Send mail to listing owner
            await sendSuccessfulBookingMailToSpaceOwner(
                listing.user.email,
                req.user.firstName,
                listing.propertyName,
                totalBookedNights,
                booking.bookedDays,
                formattedBookingTotalCharge
            )

            // console.log("Wallet: ", wallet)

            res.status(200).json({
                success: true,
                message: 'Transaction verified, listing and booking details updated successfully.',
                data: {
                    booking,
                },
            });
        } else {
            console.log("Listing not found, unable to update booked days".red);
            return res.status(400).json({
                success: false,
                message: "Listing not found, unable to update booked days"
            });
        }

    } catch (error) {
        console.error("Error verifying transaction:", error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying the transaction.',
        });
    }
});


export const handleCallback = async (req, res) => {
    const { reference } = req.query;

    try {
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${paystackSecretKey}`,
                },
            }
        );

        const { status, amount } = response.data.data;

        // Find the transaction by reference and verify the amount
        const transaction = await Transaction.findOne({ reference });

        if (transaction && transaction.amount === amount) {
            // Update transaction status and deliver value to customer
            await Transaction.findOneAndUpdate(
                { reference },
                { status }
            );

            res.status(200).json({
                status: 'success',
                message: 'Transaction verified',
                data: response.data.data,
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: 'Transaction verification failed',
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.response ? error.response.data.message : error.message,
        });
    }
}; 

export const bookWithWallet = asyncHandler(async (req, res) => {
    console.log("Creating a new booking with wallet".green);

    const userId = req.user._id;
    const { email, listingId, newBookedDays, firstName, lastName, phoneNumber, bookingForSomeone, totalGuest, discount } = req.body;

    const requiredFields = {
        email,
        listingId,
        newBookedDays,
        firstName,
        lastName,
        phoneNumber,
        totalGuest
    };

    const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        console.log("Missing fields:", missingFields.join(', ').red);
        return res.status(400).json({
            success: false,
            message: `Missing the following field(s): ${missingFields.join(', ')}`
        });
    }

    try {
        // Ensure user has a wallet
        let spaceUserWallet = await Wallet.findOne({ user: userId });

        if (!spaceUserWallet) {
            spaceUserWallet = new Wallet({
                user: userId,
                userEmail: req.user.email,
                userType: req.user.userType,
                currentBalance: 0,
                allTimeFunding: 0,
            });
            await spaceUserWallet.save();
            console.log("New spaceUserWallet created for user".yellow);
        }

        // Generate booked days excluding the checkout date
        const generateBookedDays = (checkInDate, checkOutDate) => {
            const bookedDays = [];
            let currentDate = new Date(checkInDate);

            // Loop until the day before checkOutDate
            while (currentDate < new Date(checkOutDate)) {
                bookedDays.push(new Date(currentDate).toISOString().split('T')[0]); // Add in YYYY-MM-DD format
                currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
            }

            return bookedDays;
        };

        // Use newBookedDays from the request to calculate the range
        const checkInDate = new Date(newBookedDays[0]);
        const checkOutDate = new Date(newBookedDays[newBookedDays.length - 1]); //excluding the checkOut date

        // Ensure that the bookedDays include all dates within the range except the checkout date
        const uniqueBookedDays = generateBookedDays(checkInDate, checkOutDate);

        const listing = await Listing.findById(listingId).populate('user');
        if (!listing) {
            console.log("Listing not found".red);
            return res.status(404).json({
                success: false,
                message: "Listing not found.",
            });
        }

        // Validate booking availability
        const availabilityCheck = await validateBookingAvailability({
            listingId,
            checkInDate,
            checkOutDate,
            spaceUsers: totalGuest
        });

        if (!availabilityCheck.success) {
            return res.status(400).json({
                success: false,
                message: availabilityCheck.message,
                conflictDates: availabilityCheck.conflictDates || []
            });
        }

        // Calculate total incurred charge
        const totalNights = uniqueBookedDays.length; // Total days excluding the checkout day
        const amountIncurred = listing.chargePerNight * totalNights;

        // Check if wallet balance is enough
        if (spaceUserWallet.currentBalance < amountIncurred) {
            console.log("Insufficient wallet funds".red);
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance for this booking."
            });
        }

        // Deduct balance and save
        spaceUserWallet.currentBalance -= amountIncurred;
        await spaceUserWallet.save();

        // Create new booking
        const newBooking = await Booking.create({
            user: userId,
            listing: listingId,
            invoiceId: generateInvoiceId(),
            spaceOwnerId: listing.user._id,
            firstName,
            lastName,
            email,
            phoneNumber,
            bookingForSomeone,
            paymentType: "wallet",
            paymentStatus: "completed",
            bookedDays: uniqueBookedDays,
            totalGuest,
            chargePerNight: listing.chargePerNight,
            totalNight: totalNights,
            totalIncuredCharge: amountIncurred,
            totalIncuredChargeAfterDiscount: amountIncurred - (discount || 0),
            discount: discount || 0,
            bookingStatus: "upcoming"
        });

        // Update listing with booked days
        listing.calendar.bookedDays = [...listing.calendar.bookedDays, ...uniqueBookedDays];
        if (!listing.propertyUsers.includes(userId)) {
            listing.propertyUsers.push(userId);
        }
        await listing.save();

        console.log("Transaction verified, listing and booking details updated successfully.".cyan);

        // Update space owner's wallet
        let spaceOwnerWallet = await Wallet.findOne({ user: listing.user._id });
        const listingChargePerNightWithout10PercentWithTotalNight = listing.chargePerNightWithout10Percent * totalNights;

        if (!spaceOwnerWallet) {
            spaceOwnerWallet = new Wallet({
                user: listing.user._id,
                userEmail: listing.user.email,
                userType: listing.user.userType,
                totalEarned: listingChargePerNightWithout10PercentWithTotalNight,
                currentBalance: listingChargePerNightWithout10PercentWithTotalNight,
                totalWithdrawn: 0
            });
        } else {
            spaceOwnerWallet.totalEarned += listingChargePerNightWithout10PercentWithTotalNight;
            spaceOwnerWallet.currentBalance = spaceOwnerWallet.currentBalance + listingChargePerNightWithout10PercentWithTotalNight;
        }
        await spaceOwnerWallet.save();

        console.log("Wallet successfully updated".green);

        // Create notification and message
        await Notification.create({
            user: userId,
            listing: listingId,
            title: listing.propertyName,
            subTitle: `Payment of ₦${formatAmount(amountIncurred)} has been confirmed and booking is successful for ${uniqueBookedDays.length} day(s) at ${listing.propertyName}`,
        });

        await Message.create({
            sender: listing.user._id,
            receiver: req.user._id,
            listing: listingId,
            propertyUserId: req.user._id,
            content: `Payment of ₦${formatAmount(amountIncurred)} has been confirmed and booking is successful for ${uniqueBookedDays.length} day(s) at ${listing.propertyName}`,
        });

        console.log("Notification and message created successfully.".green);

        const formattedBooking = {
            id: newBooking._id,
            paymentMethod: newBooking.paymentType,
            invoiceId: newBooking.invoiceId,
            paymentStatus: newBooking.paymentStatus,
            bookingStatus: newBooking.bookingStatus,
            firstName: newBooking.firstName,
            lastName: newBooking.lastName,
            email: newBooking.email,
            phone: newBooking.phoneNumber,
            bookingForSomeone: newBooking.bookingForSomeone,
            bookedDays: newBooking.bookedDays,
            totalGuest: newBooking.totalGuest,
            totalNights: newBooking.totalNight,
            totalIncuredCharge: newBooking.totalIncuredCharge,
            createdAt: formatDate(newBooking.updatedAt)
        };

        res.status(200).json({
            success: true,
            message: "Booking created with wallet funds",
            data: formattedBooking
        });
    } catch (error) {
        console.error("Error creating booking with wallet:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while processing the booking.",
            error: error.message
        });
    }
});


export const cancelBooking = asyncHandler(async(req, res)=> {
    console.log("Cancelling booking".yellow)

    const { bookingId } = req.body

    try {
        const booking  = await Booking.findOne(bookingId)
    } catch (error) {
        
    }
})

export const spaceOwnerFetchBookingHistoryForALisitng = asyncHandler(async (req, res) => {
    const { listingId } = req.params;
    const { bookingStatus } = req.query;

    // Construct filter object with listing ID and optional booking status
    let filter = { listing: listingId, paymentStatus: "completed" };
    if (bookingStatus) {
        console.log("Booking status", bookingStatus)
        filter.bookingStatus = bookingStatus;
    }

    try {
        console.log(`Fetching booking history for specific listing`.yellow);

        // Fetch bookings based on filter
        let bookings = await Booking.find(filter)
            .populate('user')
            .populate('listing')
            .sort({ updatedAt: -1 });

        const currentDate = new Date().toISOString().split('T')[0];

        // Update booking status to "completed" if all dates in `bookedDays` have passed
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

        // Format bookings for response
        const formattedBookings = bookings.map(booking => ({
            id: booking._id,
            invoiceId: booking.invoiceId,
            date: formatDate(booking.updatedAt),
            description: `${booking.listing.propertyId} - ${booking.listing.propertyName}`,
            guestName: `${booking.user.firstName} ${booking.user.lastName}`,
            totalNights: booking.totalNight,
            amountPaid: booking.totalIncuredChargeAfterDiscount,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
            bookedDays: booking.bookedDays
        }));

        console.log(`Booking history retrieved successfully by space owner`.cyan);
        res.status(200).json({
            success: true,
            message: "Booking history retrieved successfully",
            total: formattedBookings.length,
            data: formattedBookings,
        });
    } catch (error) {
        console.error('Error fetching booking history:', error);
        res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
            error,
        });
    }
});
