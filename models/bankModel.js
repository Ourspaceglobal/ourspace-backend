import mongoose from 'mongoose';

// Bank schema to represent each bank account the user adds
const bankSchema = new mongoose.Schema({
    bankName: { type: String, required: true },  // Bank name (e.g., "First Bank")
    accountNumber: { type: String, required: true },  // Bank account number
    accountName: { type: String, required: true },  // Name on the bank account
    bankCode: { type: String, required: true },  // Bank code (e.g., "011")
    recipientCode: { type: String },  // Paystack recipient code
});

// Main BankDetails schema, referencing the user and holding an array of bank accounts
const bankDetailsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    banks: [bankSchema],  
}, {
    timestamps: true,
});

const BankDetails = mongoose.model('BankDetails', bankDetailsSchema);

export default BankDetails;
 