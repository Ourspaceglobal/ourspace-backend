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
        enum: ["otp", "pending", "completed", "success", "failed"],
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

withdrawalSchema.pre('save', async function (next) {
    const withdrawal = this;

    if (withdrawal.isNew) { // Ensure it only runs for new documents
        // Generate unique transaction ID
        if (!withdrawal.transactionId) {
            let uniqueTransactionId = false;
            while (!uniqueTransactionId) {
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                const newTransactionId = `OS-W${randomNum}`;

                const existingTransaction = await mongoose.model('Withdrawal').findOne({ transactionId: newTransactionId });
                if (!existingTransaction) {
                    withdrawal.transactionId = newTransactionId;
                    uniqueTransactionId = true;
                }
            }
        }

        // Generate unique transfer reference
        if (!withdrawal.transferReference) {
            const generateTransferReference = () => {
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let reference = '';
                for (let i = 0; i < 16; i++) {
                    reference += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                return reference;
            };

            let uniqueTransferReference = false;
            while (!uniqueTransferReference) {
                const newTransferReference = generateTransferReference();

                const existingReference = await mongoose.model('Withdrawal').findOne({ transferReference: newTransferReference });
                if (!existingReference) {
                    withdrawal.transferReference = newTransferReference;
                    uniqueTransferReference = true;
                }
            }
        }
    }

    next();
});



const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;
