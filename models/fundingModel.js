import mongoose from "mongoose";

const walletFundingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount_to_fund: { type: Number, required: true},
    payment_status: { 
        type: String,
        enum: ["pending", "failed", "successful"],
        default: "pending",
        required: true
     },
     invoiceId: { 
        type: String, 
        default: null, 
        unique: true 
    },
     current_balance_before_funding: { type: Number, required: true },
     current_balance_after_funding: {type: Number, required: true},
     all_time_wallet_funding: { type: Number, required: true },
     authorization_url: { type: String, required: true },
     access_code: { type: String, required: true },
     paystack_ref: { type: String, required: true},
     display_image: { type: String, required: true},
     mode_of_funding: {type: String, default: "web-payment", required: true}
}, {timestamps: true})

// Pre-save hook to generate and assign a unique invoiceId
walletFundingSchema.pre('save', async function (next) {
    const walletFunding = this;

    // Only generate if invoiceId is not already set
    if (!walletFunding.invoiceId) {
        let isUnique = false;
        let invoiceId;

        // Generate new invoiceId until it's unique
        while (!isUnique) {
            invoiceId = generateInvoiceId();
            const existingWalletFunding = await mongoose.models.FundingHistory.findOne({ invoiceId });
            if (!existingWalletFunding) {
                isUnique = true;
            }
        }

        walletFunding.invoiceId = invoiceId;
    }

    next();
});

function generateInvoiceId() {
  const randomDigits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
  return `W${randomDigits}`;
}

const FundingHistory = mongoose.model("FundingHistory", walletFundingSchema)

export default FundingHistory;