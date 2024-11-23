import axios from 'axios';
import sendEmail from '../../utils/sendMail.js';
import Booking from '../../models/bookingModel.js';
import Listing from '../../models/listingModel.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import Notification from '../../models/notificationModel.js';
import { formatAmount } from '../../utils/helperFunction.js';
import Message from '../../models/messageModel.js';

export const initializeTransaction = asyncHandler(async (req, res) => {
    console.log("Initializing Paystack payment...".green);

    const userId = req.user._id

    const {
        email, amountInNaira, callBackUrl,listingId, newBookedDays,
        firstName, lastName, phoneNumber, bookingForSomeone, totalGuest, discount
    } = req.body;

    // Input validation

    if(!email || !amountInNaira || !callBackUrl || !listingId || !newBookedDays || !firstName || !lastName || !phoneNumber ||!totalGuest) {
        console.log("All fields are required".red)
        res.status(400).json({
            success: false,
            message: "All fields are required"
        })
    }

    const amountInKobo = amountInNaira * 100;

    // Retrieve listing from database
    const listing = await Listing.findById(listingId);

    if (!listing) {
        console.log("Listing not found".red)
        return res.status(404).json({
            success: false,
            message: 'Listing not found.',
        });
    }

    const conflictingDates = listing.bookedDays.filter(date => newBookedDays.includes(date));

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
                    Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const { authorization_url, access_code, reference } = response.data.data;

        const callBackWithReference = `${callBackUrl}?reference=${reference}`;

        const newBooking = await Booking.create({
            user: userId,
            listing: listingId,
            paystackRef: reference,
            paystackAccessCode: access_code,
            paystackReference: reference,
            paystackPaymentStatus: "pending",
            firstName,
            lastName,
            email,
            phoneNumber,
            bookingForSomeone,
            bookedDays: newBookedDays,
            totalGuest,
            amount: amountInNaira,
            discount: discount || 0
        });

        await newBooking.save()
        

        console.log(`Transaction initialized for amount: ₦${amountInNaira}`.cyan);

        res.status(200).json({
            success: true,
            message: `Transaction initialized successfully and new booking created.`,
            data: {
                authorization_url,
                access_code,
                reference,
                callBackWithReference,
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
                    Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`,
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

        const booking = await Booking.findOne({ paystackReference: reference });

        if (!booking) {
            console.log("Payment was successful, but the booking was not found in the database".red);
            return res.status(404).json({
                success: false,
                message: 'Payment was successful, but the booking was not found in the database.',
            });
        }

        if (booking.paystackPaymentStatus === 'success') {
            console.log("booking has already been verified as successful".bgRed);
            return res.status(400).json({
                success: false,
                message: 'Transaction has already been verified as successful.',
            });
        }

        const normalAmount = paystackKoboAmount / 100;

        if (booking.amount !== normalAmount) {
            console.log("Paid amount does not match expected amount.".red)
            return res.status(400).json({
                success: false,
                message: 'Paid amount does not match expected amount.',
            });
        }

        const ourspaceEmail = process.env.OUR_SPACE_EMAIL;
        const maximusEmail = process.env.MAXIMUS_EMAIL;
        // await sendEmail(
        //     ourspaceEmail,
        //     "Ourspace bookings payment",
        //     `A new payment of #${normalAmount} was made by ${customer.email}.`
        // );
        // console.log("Payment confirmed, and email sent".cyan);

        // Update transaction status to 'success'
        booking.paystackPaymentStatus = 'success';
        booking.bookingStatus = 'upcoming';
        await booking.save();

        if (!booking) {
            console.log("Booking not found".red);
            return res.status(400).json({
                success: false,
                message: "No booking with reference found"
            });
        }

        const listing = await Listing.findById(listingId).populate('user');

        if(listing) {
            
            const newBookedDays = booking.bookedDays;
            listing.bookedDays = [...listing.bookedDays, ...newBookedDays];
            await listing.save();

            console.log("Transaction verified, listing and booking details updated successfully.".cyan);

            const listingOwner = listing.user;
            const displayImage = listingOwner.profilePic.url || '';

            // create a new notification for space user
            await Notification.create({
                user: userId,
                listing: listingId,
                title: listing.propertyName,
                subTitle: `Your payment of ₦${formatAmount(normalAmount)} has been confirmed and your booking is successful for ${newBookedDays.length} day(s) at ${listing.propertyName}`,
            });

            await Message.create({
                sender: listing.user._id,
                receiver: req.user._id,
                listing: listingId,
                propertyUserId: req.user._id,
                content: `New booking is successful for ${uniqueBookedDays.length} day(s) at ${listing.propertyName}`,
            })

            console.log("Notification and Message created successfully.".green);

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

