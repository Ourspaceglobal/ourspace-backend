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
            message: `Missing the following field(s): ${missingFields.join(', ')}`,
        });
    }

    try {
        const listing = await Listing.findById(listingId);

        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }

        const { availability = [], calendar, maximumGuestNumber } = listing; // Default empty array if availability is undefined
        const { unavailableDays } = calendar;

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // Generate the array of dates from checkIn to checkOut
        const checkInToCheckOutDates = [];
        for (let d = new Date(checkInDate); d <= checkOutDate; d.setDate(d.getDate() + 1)) {
            checkInToCheckOutDates.push(d.toISOString().split('T')[0]);
        }

        // Check if the listing is available (if availability is enforced)
        if (Array.isArray(availability) && availability.length > 0) {
            const unavailableDates = checkInToCheckOutDates.filter(date => !availability.includes(date));
            if (unavailableDates.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Listing is not available for the following dates: ${unavailableDates.join(", ")}`,
                });
            }
        }

        // Check for conflicts with unavailable days (union of booked and blocked days)
        const conflictDates = checkInToCheckOutDates.filter(date => unavailableDays.includes(date));
        if (conflictDates.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Listing is unavailable for the following dates: ${conflictDates.join(", ")}`,
                bookedDates: conflictDates,
            });
        }

        if (spaceUsers > maximumGuestNumber) {
            return res.status(400).json({
                success: false,
                message: `The number of guests exceeds the maximum allowed. Maximum allowed is ${maximumGuestNumber}.`,
            });
        }

        res.status(200).json({
            success: true,
            message: "Listing is available for booking",
            availableDates: checkInToCheckOutDates,
        });

    } catch (error) {
        console.log(`Error checking availability: ${error.message}`.red);
        res.status(500).json({
            success: false,
            message: "An error occurred while checking availability",
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

    const userId = req.user._id

    const {
        email, callBackUrl,listingId, newBookedDays,
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

    const uniqueBookedDays = newBookedDays.length === 2 && newBookedDays[0] === newBookedDays[1] 
    ? [newBookedDays[0]] // Only keep one if both dates are the same
    : newBookedDays;
    

    // Retrieve listing from database
    const listing = await Listing.findById(listingId).populate('user');

    if (!listing) {
        console.log("Listing not found".red);
        return res.status(404).json({
            success: false,
            message: "Listing not found.",
        });
    }

    const listingCharge = listing.chargePerNight
    const totalNights = uniqueBookedDays.length
    const amountIncurred = listingCharge * totalNights
    const totalAmountIncured = amountIncurred + 2000 
    const listingDiscount = listing.discount

    console.log("Booked dates: ", uniqueBookedDays)

    const amountInKobo = totalAmountIncured * 100;

    const conflictingDates = listing.calendar.unavailableDays.filter(date => uniqueBookedDays.includes(date));

    if (conflictingDates.length > 0) {
        console.log("Some of the selected dates are already booked".red)
        return res.status(400).json({
            success: false,
            message: 'Some of the selected dates are already booked.',
            data: { conflictingDates }
        });
    }

    try {
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

        const newBooking = await Booking.create({
            user: userId,
            listing: listingId,
            spaceOwnerId: listing.user._id,
            paymentType: "paystack",
            paymentStatus: "payment-pending",
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
        await newBooking.save()
        

        console.log(`charge per night: ${listingCharge}\nTotal nights booked: ${totalNights}\nTotal incured charge: ${totalAmountIncured}\n`.cyan)
        res.status(200).json({
            success: true,
            message: `Transaction initialized. Total amount incured for ${totalNights} night(s) at ${listingCharge} per night is: ${totalAmountIncured}`,
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
    console.log("Verifying transaction...".green);

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
                    Authorization: `Bearer ${process.env.PAYSTACK_LIVE_SECRET_KEY}`,
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
        //         message: 'Transaction has already been verified as successful.',
        //     });
        // }

        const amountPaidToPaystack = paystackKoboAmount / 100;

        console.log(`Total incured charge: ${booking.totalIncuredCharge}\nAmount paid by user: ${amountPaidToPaystack}`.yellow)

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
        booking.paymentStatus = 'success';
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
            console.log("Booked days: ",newBookedDays)
            listing.calendar.bookedDays = [...listing.calendar.bookedDays, ...newBookedDays];
            // Check if the user is already in propertyUsers
            if (!listing.propertyUsers.includes(userId)) {
                listing.propertyUsers.push(userId); 
            }
            
            await listing.save();

            console.log("Transaction verified, listing and booking details updated successfully.".cyan);

            const listingOwner = listing.user;

            console.log("Updating wallet".blue) 

            let wallet = await Wallet.findOne({ user: listing.user._id });

            // Subtract 10% and 2000 from the total incurred charge
            const realListingChargePerNIght = listing.chargePerNightWithout10Percent
          
            if (!wallet) {
                console.log("No wallet info found, creating a new one".yellow);
                // If no wallet exists, create a new wallet for the user
                wallet = new Wallet({
                    user: listing.user._id,
                    userEmail: listing.user.email,
                    userType: listing.user.userType,
                    totalEarned: realListingChargePerNIght,  
                    currentBalance: realListingChargePerNIght, 
                    totalWithdrawn: 0
                });
            } else {
                // Update the existing wallet
                const newTotalEarned = wallet.totalEarned + realListingChargePerNIght;
                const newCurrentBalance = newTotalEarned - wallet.totalWithdrawn;

                wallet.totalEarned = newTotalEarned;
                wallet.currentBalance = newCurrentBalance;
            }

            await wallet.save();
            console.log("Wallet successfully updated".green)

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

            console.log("Wallet: ", wallet)

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
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                userEmail: req.user.email,
                userType: req.user.userType,
                currentBalance: 0, 
                allTimeFunding: 0,
            });
            await wallet.save();
            console.log("New wallet created for user".yellow);
        }
    
        const uniqueBookedDays = newBookedDays.length === 2 && newBookedDays[0] === newBookedDays[1] 
        ? [newBookedDays[0]] // Only keep one if both dates are the same
        : newBookedDays;

        const listing = await Listing.findById(listingId).populate('user');
        if (!listing) {
            console.log("Listing not found".red);
            return res.status(404).json({
                success: false,
                message: "Listing not found.",
            });
        }

        // Calculate total incurred charge
        const listingChargePerNightWith10Percent = listing.chargePerNight
        const totalNights = uniqueBookedDays.length
        const amountIncurred = listingChargePerNightWith10Percent * totalNights
        const totalAmountIncuredWithTotalNightsAnd2000Charges = amountIncurred + 2000

        // Check for conflicting dates
        const conflictingDates = listing.calendar.unavailableDays.filter(date => newBookedDays.includes(date));
        if (conflictingDates.length > 0) {
            console.log("Some of the selected dates are already booked".red);
            return res.status(400).json({
                success: false,
                message: 'Some of the selected dates are already booked.',
                data: { conflictingDates }
            });
        }

        // Check if wallet balance is enough
        if (wallet.currentBalance < totalAmountIncuredWithTotalNightsAnd2000Charges) {
            console.log("Insufficient wallet funds".red);
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance for this booking."
            });
        }

        // Deduct balance and save
        wallet.currentBalance -= totalAmountIncuredWithTotalNightsAnd2000Charges;
        await wallet.save();

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
            chargePerNight: listingChargePerNightWith10Percent,
            totalNight: totalNights,
            totalIncuredCharge: totalAmountIncuredWithTotalNightsAnd2000Charges,
            totalIncuredChargeAfterDiscount: totalAmountIncuredWithTotalNightsAnd2000Charges - (discount || 0),
            discount: discount || 0,
            bookingStatus: "pending"
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
        const listingChargePerNightWithout10PercentWithTotalNight = listing.chargePerNightWithout10Percent * uniqueBookedDays.length

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
            spaceOwnerWallet.currentBalance = spaceOwnerWallet.totalEarned - spaceOwnerWallet.totalWithdrawn;
        }
        await spaceOwnerWallet.save();

        console.log("Wallet successfully updated".green);

        // Create notification and message
        await Notification.create({
            user: userId,
            listing: listingId,
            title: listing.propertyName,
            subTitle: `Your payment of ₦${formatAmount(totalAmountIncuredWithTotalNightsAnd2000Charges)} has been confirmed and your booking is successful for ${newBookedDays.length} day(s) at ${listing.propertyName}`,
        });

        await Message.create({
            sender: listing.user._id,
            receiver: req.user._id,
            listing: listingId,
            propertyUserId: req.user._id, 
            content: `Your payment of ₦${formatAmount(totalAmountIncuredWithTotalNightsAnd2000Charges)} has been confirmed and your booking is successful for ${newBookedDays.length} day(s) at ${listing.propertyName}`,
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
        }

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

export const getBookingsForListingId = asyncHandler(async (req, res) => {
    const { listingId } = req.params;
  
    try {
        console.log(`Fetching booking history for specific listing`.blue);
  
        const bookings = await Booking.find({ listing: listingId })
            .populate('user', 'name')
            .sort({ date: -1 });
  
        console.log(`Booking history retrieved for listing ID: ${listingId}`.green);
  
        const formattedBookings = bookings.map(booking => ({
            date: booking.date,
            description: booking.description,
            guestName: booking.user.name,
            nightsSpent: booking.nightsSpent,
            amountPaid: booking.amountPaid,
        }));
  
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
 