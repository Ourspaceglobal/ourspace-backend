import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentType: {
        type: String,
        enum: ["paystack", "wallet", "bank-payment"],
        default: "bank-payment",
        required: true
    },
    spaceOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
    invoiceId: { 
        type: String, 
        default: null, 
        unique: true 
    },
    paystackAccessCode: { type: String },
    paystackReference: { type: String },
    paystackPaymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
    },
    paymentStatus: {
        type: String,
        enum: ['payment-pending', "completed" , "failed", "cancelled"],
        default: 'payment-pending',
        required: true
    },
    bookingStatus: {
        type: String,
        enum: ['upcoming','payment-pending', 'in-progress','completed', "cancelled"],
        default: 'payment-pending',
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    bookingForSomeone: {
        fullName: String,
        phoneNumber: String
    },
    bookedDays: {
        type: [String],
        required: true,
        validate: {
            validator: function(v) {
                return v.every(date => !isNaN(Date.parse(date)));
            },
            message: props => `${props.value} contains invalid date format.`
        }
    },
    totalGuest: {
        type: Number,
        required: true,
        min: [1, 'At least one guest is required.']
    },

    chargePerNight: {
        type: Number,
        required: true,
        min: [0, 'Charge per night cannot be negative.']
    },

    totalNight: {
        type: Number,
        required: true,
        min: [0, 'Total night is required.']
    },

    totalIncuredCharge: {
        type: Number,
        required: true,
        min: [0, 'Total incured charge is required.']
    },

    totalIncuredChargeAfterDiscount: {
        type: Number,
        required: true,
        min: [0, 'Total incured charge is required.']
    },

    discount: {
        type: Number,
        default: 0,
        min: [0, 'Discount cannot be negative.']
    },
}, { timestamps: true });

// Pre-save hook to generate and assign a unique invoiceId
bookingSchema.pre('save', async function (next) {
    const booking = this;

    // Only generate if invoiceId is not already set
    if (!booking.invoiceId) {
        let isUnique = false;
        let invoiceId;

        // Generate new invoiceId until it's unique
        while (!isUnique) {
            invoiceId = generateInvoiceId();
            const existingBooking = await mongoose.models.Booking.findOne({ invoiceId });
            if (!existingBooking) {
                isUnique = true;
            }
        }

        booking.invoiceId = invoiceId;
    }

    next();
});

function generateInvoiceId() {
  const randomDigits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
  return `B${randomDigits}`;
}

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;

