import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, 
    adminInCharge: {
        type: mongoose.Schema.Types.ObjectId,
    },
    paystack_id: { 
        type: String, 
    },
    transactionId: {
        type: String,
        unique: true, // Ensure transactionId is unique in the database
    },
    transferReference: {
        type: String,
    },
    methodOfWithdrawal: { 
        type: String, 
    },  
    withdrawalAmount: { 
        type: Number, 
        required: true 
    },
    status: {  
        type: String, 
        enum: ["pending", "failed", "on-hold", "completed", "rejected"],
        default: 'pending', 
        required: true
    },
    accountNumberWithdrawnTo: {
        type: String,
    },
    bankNameWithdrawnTo: {
        type: String,
    },
    recipient_code: { 
        type: String, 
    },
    transferReference: { 
        type: String, 
    },
    transfer_code: { 
        type: String 
    }, 
    reference: { 
        type: String,
    },
    source: { 
        type: String, 
    },
    paystack_status: {
        type: String,
        enum: ["otp", "pending", "completed", "success"],
        default: "otp",
        required: true
    },
    reason: { 
        type: String, 
        default: 'Withdrawal from wallet' 
    },
    failures: { 
        type: String 
    },
    otp: { 
        type: String 
    },
    paystack_createdAt: { 
        type: Date, 
        default: Date.now 
    },
    paystack_updatedAt: { 
        type: Date 
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Middleware to generate unique transaction ID
withdrawalSchema.pre('save', async function (next) {
    const withdrawal = this;

    if (!withdrawal.transactionId) {
        let unique = false;
        while (!unique) {
            // Generate random transaction ID
            const randomNum = Math.floor(100000 + Math.random() * 900000); // Generate 6 random digits
            const newTransactionId = `OS-W${randomNum}`;

            // Check if the transactionId already exists
            const existingWithdrawal = await mongoose.model('Withdrawal').findOne({ transactionId: newTransactionId });
            if (!existingWithdrawal) {
                withdrawal.transactionId = newTransactionId;
                unique = true;
            }
        }
    }

    next();
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;
