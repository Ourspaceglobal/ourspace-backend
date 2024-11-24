import axios from "axios"
import asyncHandler from "../../middleware/asyncHandler.js"
import Withdrawal from "../../models/withdrawalRequestModel.js"
import { formatDate } from "../../utils/helperFunction.js"
import mongoose from "mongoose"
import { v4 as uuidv4 } from 'uuid'; 

const generateTransferReference = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let reference = '';
    
    for (let i = 0; i < 16; i++) {
        reference += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return reference;
};


export const getAllPayouts = asyncHandler(async(req, res) => {
    console.log("Admin geting all payout requests".cyan)

    try {
        const withdrawals = await Withdrawal.find().populate("user").sort({createdAt: -1})

        if(!withdrawals){
            console.log("No withdrawal at the moment".red)
            return res.status(200).json({
                success: true,
                message: "No withdrawal found at the moment"
            })
        }

        const formattedWithdrawals = withdrawals.map((withdrawal) => ({
            id: withdrawal._id,
            transactionId: withdrawal.transactionId || "......",
            method: withdrawal.methodOfWithdrawal || "......",
            accountNumber: withdrawal.accountNumberWithdrawnTo || "......",
            email: withdrawal.user.email || "......",
            amountWithdrawn: withdrawal.withdrawalAmount || "......",
            status: withdrawal.status || "......",
            updatedTime: formatDate(withdrawal.updatedAt) || "......",
        }));

        console.log(`Total of ${withdrawals.length} withdrawals found`.rainbow)
        return res.status(200).json({
            success: true,
            message: `Total of ${withdrawals.length} withdrawals found`,
            data: formattedWithdrawals
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error
        })
    }
})

export const getPayoutById = asyncHandler(async (req, res) => {
    console.log("Admin getting payout request by ID".cyan);

    try {
        // Retrieve the withdrawal request by ID from the request parameters
        const { id } = req.params;

        // Find the withdrawal by ID and populate user details
        const withdrawal = await Withdrawal.findById(id).populate("user");

        // Check if the withdrawal exists
        if (!withdrawal) {
            console.log("Withdrawal request not found".red);
            return res.status(404).json({
                success: false,
                message: "Withdrawal request not found",
            });
        }

        // Format the withdrawal details
        const formattedWithdrawal = {
            id: withdrawal._id,
            userName: withdrawal.user.firstName + " " + withdrawal.user.lastName || "......",
            method: withdrawal.methodOfWithdrawal || "......",
            amountWithdrawn: withdrawal.withdrawalAmount || "......",
            accountNumber: withdrawal.accountNumberWithdrawnTo || "......",
            status: withdrawal.status || "......",
        };

        console.log(`Withdrawal request found with ID: ${withdrawal._id}`.rainbow);
        return res.status(200).json({
            success: true,
            message: `Withdrawal request found`,
            data: formattedWithdrawal,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message || "Server error",
        });
    }
});

export const adminRequestWithdrawalOtpFromPaystack = asyncHandler(async (req, res) => {
    console.log("Admin requesting withdrawal OTP from Paystack".cyan);

    const { withdrawalId } = req.body;

    if (!withdrawalId) {
        console.log("Withdrawal ID is required".red);
        return res.status(400).json({
            success: false,
            message: "Withdrawal ID is required",
        });
    }

    // Start a session for MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Retrieve the withdrawal request
        const existingWithdrawal = await Withdrawal.findById(withdrawalId).session(session);

        if (!existingWithdrawal) {
            console.log("Withdrawal cannot be found".red);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Withdrawal request not found",
            });
        }

        const transferReference = generateTransferReference(); 
        console.log(`Generated Transfer Reference: ${transferReference}`.yellow); 

        let paystackKey;
        if (process.env.NODE_ENV === "development") {
            paystackKey = process.env.PAYSTACK_TEST_SECRET_KEY;
        } else {
            paystackKey = process.env.PAYSTACK_LIVE_SECRET_KEY;
        }

        // Make the request to Paystack
        const response = await axios.post(
            `https://api.paystack.co/transfer`,
            {
                source: "balance",  // Paystack balance
                amount: existingWithdrawal.withdrawalAmount * 100,  // Convert to kobo (cents)
                recipient: existingWithdrawal.recipient_code,
                reference: transferReference,
                reason: "withdrawal from wallet",
            },
            {
                headers: {
                    Authorization: `Bearer ${paystackKey}`,
                },
            }
        );

        const { status, data } = response.data;

        if (!status) {
            console.log("Error from Paystack: ", data);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Failed to request OTP from Paystack",
                error: data,
            });
        }

        console.log("transfer code: ", data.transfer_code)

        // Update withdrawal with Paystack data
        existingWithdrawal.paystack_id = data.id;
        existingWithdrawal.paystack_status = data.status;
        existingWithdrawal.transfer_code = data.transfer_code;
        existingWithdrawal.transferReference = transferReference;

        console.log("transfer code: ", existingWithdrawal.transfer_code)

        await existingWithdrawal.save({ session });

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        session.endSession();

        const formattedResponse = {
            code: existingWithdrawal.transfer_code,
        };

        console.log("Withdrawal OTP successfully requested".cyan);
        return res.status(200).json({
            success: true,
            message: "Withdrawal OTP successfully requested",
            data: formattedResponse,
        });

    } catch (error) {
        // In case of any error, abort the transaction and end the session
        await session.abortTransaction();
        session.endSession();

        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message || error,
        });
    }
});


export const approveWithdrawal = asyncHandler(async (req, res) => {
    console.log("Admin approving withdrawal from Paystack".cyan);

    const { withdrawalId, otp } = req.body;

    if (!withdrawalId || !otp) {
        console.log("Withdrawal ID and OTP are required".red);
        return res.status(400).json({
            success: false,
            message: "Withdrawal ID and OTP are required",
        });
    }

    // Start a session for transaction handling
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Retrieve the withdrawal request
        const existingWithdrawal = await Withdrawal.findById(withdrawalId).session(session);

        if (!existingWithdrawal) {
            console.log("Withdrawal cannot be found".red);
            await session.abortTransaction(); 
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Withdrawal request not found",
            });
        }

        if (existingWithdrawal.status === "completed") {
            console.log("Withdrawal has already been verified".red);
            await session.abortTransaction(); 
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Withdrawal already verified",
            });
        }

        // Variables needed for Paystack API request
        const paystackKey = process.env.NODE_ENV === "development" 
            ? process.env.PAYSTACK_TEST_SECRET_KEY
            : process.env.PAYSTACK_LIVE_SECRET_KEY;

        if (!paystackKey) {
            console.log("Paystack API key is missing or invalid".red);
            return res.status(500).json({
                success: false,
                message: "Paystack API key is missing or invalid",
            });
        }

        const transferCode = existingWithdrawal.transfer_code;
        console.log("Transfer code: ",transferCode)

        try {

            const response = await axios.post(
                `https://api.paystack.co/transfer/finalize_transfer`,
                {
                    otp, 
                    transfer_code: transferCode,  // Pass the generated transfer reference
                },
                {
                    headers: {
                        Authorization: `Bearer ${paystackKey}`,
                    },
                }
            );
        
            // Log only the essential fields
            const { status, data, message } = response.data;

            console.log("Transfer State: ", response.data);

            // Debugging response data to see what we are getting
            console.log("Paystack Response: ", response.data);

            if (status) {
                
                existingWithdrawal.paystack_status = "success",
                existingWithdrawal.status = "completed"
                
                await existingWithdrawal.save({ session });
                
                console.log(`Paystack OTP Verification Successful`.rainbow);
                
            } else {
                console.log(`Paystack OTP Verification Failed: ${message}`.red);

                return res.status(500).json({
                    success: false,
                    message: `Withdrawal approval failed: ${message}`,
                    data: {
                        transfer_code: data.transfer_code,
                        status: data.status,
                    },
                });
            }
        
            // Return the formatted response if needed
            return res.status(200).json({
                success: true,
                message: "Withdrawal successfully approved",
                data: {
                    transfer_code: data.transfer_code,
                    status: data.status,
                },
            });
        
        } catch (error) {
            console.log("Error while approving withdrawal:".yellow);

            if (error.response) {
                console.log("Paystack Error Response: ", error.response.data);
            } else if (error.request) {
                console.log("No response received: ", error.request);
            } else {
                // Something happened in setting up the request
                console.log("Error in request setup: ", error.message);
            }

            return res.status(500).json({
                success: false,
                message: "Server error while approving withdrawal",
                error: error.message || error,
            });
        }

    } catch (error) {
        // Abort the transaction if any error occurs
        console.log("Error while approving withdrawal: ", error);
        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: "Server error while approving withdrawal",
            error: error.message || error,
        });
    }
});