import axios from "axios";
import asyncHandler from "../middleware/asyncHandler.js";
import Booking from "../models/bookingModel.js";
import Wallet from "../models/walletModel.js";
import { formatAmount, formatDate, formatDateForSUTransactionHistory, formatDateWithoutTime, generateBookingInvoicePDF, generateWithdrawalInvoicePDF } from "../utils/helperFunction.js";
import BankDetails from "../models/bankModel.js";
import User from "../models/userModel.js";
import Withdrawal from "../models/withdrawalRequestModel.js";
import FundingHistory from "../models/fundingModel.js";

export const spaceOwnerGetWallet = asyncHandler(async (req, res) => {
    console.log("Getting wallet dashboard...".blue);

    let walletMetrics = await Wallet.findOne({ user: req.user._id });

    if (!walletMetrics) {
        console.log("Wallet not found, using default values".yellow);
        walletMetrics = {
            currentBalance: 0,
            totalWithdrawn: 0,
            totalEarned: 0,
        };
    }

    try {
        // Fetch bookings and populate related models (listing and user)
        const bookings = await Booking.find({
            spaceOwnerId: req.user._id,
            paymentStatus: "completed"
        })
            .populate('listing')
            .populate('user')
            .sort({ updatedAt: -1 });

        // Delete invalid bookings and prepare formatted data
        const validBookings = [];
        for (const booking of bookings) {
            // Check if the referenced listing or user is null
            if (!booking.listing || !booking.user) {
                console.log(
                    `Deleting invalid booking ${booking._id} because listing or user is missing`.red
                );
                await Booking.findByIdAndDelete(booking._id);
                continue; // Skip this invalid booking
            }

            const currentDate = new Date();

            // Validate bookedDays and update booking status
            if (Array.isArray(booking.bookedDays) && booking.bookedDays.length > 0) {
                const firstBookedDay = new Date(booking.bookedDays[0]);
                const lastBookedDay = new Date(booking.bookedDays[booking.bookedDays.length - 1]);

                if (booking.paymentStatus === "completed") {
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
                }
            }

            // Add valid bookings to the list
            validBookings.push({
                id: booking._id,
                transactionId: booking.invoiceId,
                bookingId: booking.invoiceId,
                date: formatDate(booking.createdAt),
                spaceName: booking.listing.propertyName || "null",
                totalNights: booking.totalNight,
                spaceUserName: booking.user.firstName || "null",
                amountEarned: booking.listing.chargePerNightWithout10Percent * booking.totalNight || "null",
                status: booking.bookingStatus
            });
        }

        // Fetch and format withdrawals
        const withdrawals = await Withdrawal.find({
            user: req.user._id,
        }).populate("user").sort({ createdAt: -1 });

        function maskNumber(number) {
            if (!number || typeof number !== "string") {
                return "******"; // Return a placeholder if the number is invalid
            }
            const maskedPart = "*".repeat(number.length - 4); // Generate asterisks for all but the last 4 digits
            const visiblePart = number.slice(-4); // Get the last 4 digits
            return maskedPart + visiblePart; // Combine masked and visible parts
        }
        
        const formattedWithdrawals = withdrawals.map((withdrawal) => ({
            id: withdrawal._id,
            payoutId: withdrawal.transactionId,
            invoiceId: withdrawal.paystack_id,
            date: formatDate(withdrawal.createdAt),
            amountWithdrawn: withdrawal.withdrawalAmount,
            withdrawnTo: maskNumber(withdrawal.accountNumberWithdrawnTo) || null, 
            status: withdrawal.status,
        }));
        

        return res.status(200).json({
            success: true,
            message: "User dashboard successfully retrieved",
            data: {
                wallet: {
                    availableBalance: walletMetrics.currentBalance,
                    totalEarnings: walletMetrics.totalEarned,
                },
                bookings: validBookings,
                withdrawals: formattedWithdrawals,
            },
        });
    } catch (error) {
        console.error("Error getting wallet:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting wallet",
        });
    }
});

export const soGetSingleBookingFromWalletDashboard = asyncHandler(async (req, res) => {
    console.log("Getting single booking from wallet dashboard".cyan);

    const { walletBookingId, withdrawalId } = req.query;

    if(!withdrawalId) {
        try {
            // Fetch the booking and populate the listing
            const bookingPayment = await Booking.findById(walletBookingId).populate('listing').populate("user");
            
            if (!bookingPayment) {
                console.log("Booking payment not found".red);
                return res.status(404).json({
                    success: false,
                    message: "Booking payment history not found",
                });
            }
    
            const formattedData = {
                id: bookingPayment._id,
                invoiceId: bookingPayment.invoiceId,  
                date: formatDate(bookingPayment.createdAt),
                propertyName: bookingPayment.listing.propertyName,
                paymentMethod: bookingPayment.paymentType,
                // user: bookingPayment.user.firstName + " " + bookingPayment.user.lastName,
                description: `${bookingPayment.listing.propertyId} - ${bookingPayment.listing.propertyName} (Room ${bookingPayment.listing.propertyLocation.apartmentNumber})`,
                totalNights: bookingPayment.bookedDays.length,
                chargePerNight: bookingPayment.listing.chargePerNightWithout10Percent,
                totalIncuredCharge: `${formatAmount(bookingPayment.listing.chargePerNightWithout10Percent * bookingPayment.bookedDays.length)}`
            };
    
            console.log("Booking payment history found".green);
            return res.status(200).json({
                success: true,
                message: "Booking successfully retrieved",
                data: formattedData
            });
    
        } catch (error) {
            console.error("Error retrieving booking payment history".red, error);
            return res.status(500).json({
                success: false,
                message: "An error occurred while retrieving the booking",
            });
        }
    } else if(!walletBookingId) {
        try {
            // Fetch the booking and populate the listing
            const withdrawal = await Withdrawal.findById(withdrawalId).populate("user");
            
            if (!withdrawal) {
                console.log("Withdrawal request history not found".red);
                return res.status(404).json({
                    success: false,
                    message: "Withdrawal request history not found",
                });
            }
    
            // Prepare the data for the PDF
            const withdrawalData = {
                id: withdrawal._id,
                invoiceId: withdrawal.paystack_id,
                date: formatDate(withdrawal.createdAt),
                amount: `#${formatAmount(withdrawal.amount)}`,
                accountNumber: "incoming",
                status: withdrawal.status
            };
    
            console.log("Booking payment history found".green);
            return res.status(200).json({
                success: true,
                message: "Booking successfully retrieved",
                data: withdrawalData
            });
    
        } catch (error) {
            console.error("Error retrieving withdrawal request history".red, error);
            return res.status(500).json({
                success: false,
                message: "An error occurred while retrieving the withdrawal request history",
            });
        }
    }

});

export const downloadBookingPDF = asyncHandler(async (req, res) => {
    const { walletBookingId, withdrawalId } = req.query;

    if(walletBookingId) {
        console.log("Generating booking invoice pdf".cyan)
        try {
            const bookingPayment = await Booking.findById(walletBookingId).populate('listing').populate("user");
    
            if (!bookingPayment) {
                return res.status(404).json({
                    success: false,
                    message: "Booking payment history not found",
                });
            }
    
            // Prepare the data for the PDF
            const bookingData = {
                invoiceId: bookingPayment.invoiceId,
                propertyUserName: bookingPayment.user.firstName + " " + bookingPayment.user.lastName,
                propertyName: bookingPayment.listing.propertyName,
                date: formatDate(bookingPayment.createdAt),
                description: `${bookingPayment.listing.propertyId} - ${bookingPayment.listing.propertyName} (Room ${bookingPayment.listing.propertyLocation.apartmentNumber})`,
                amount: `#${formatAmount(bookingPayment.totalIncuredChargeAfterDiscount)}`
            };
    
            // Set headers to indicate a PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
    
            // Call the PDF generation function
            generateBookingInvoicePDF(bookingData, res);
    
        } catch (error) {
            console.error("Error generating booking PDF:", error);
            return res.status(500).json({
                success: false,
                message: "An error occurred while generating the PDF.",
            });
        }
    } else if (withdrawalId) {
        console.log("generating withdrawal invoice as pdf".green)
        try {
            const withdrawalRequest = await Withdrawal.findById(withdrawalId);
    
            if (!withdrawalRequest) {
                console.log("Withdrawal request not found".red)
                return res.status(500).json({
                    success: false,
                    message: "Withdrawal request not found"
                })
            }
    
            // Prepare the data for the PDF
            const withdrawalData = {
                invoiceId: withdrawalRequest.paystack_id,
                date: formatDate(withdrawalRequest.createdAt),
                description: `${withdrawalRequest.reason}`,
                amount: `#${formatAmount(withdrawalRequest.amount)}`,
                withdrawalStatus: withdrawalRequest.status
            };
    
            // Set headers to indicate a PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
    
            // Call the PDF generation function
            generateWithdrawalInvoicePDF(withdrawalData, res);
    
        } catch (error) {
            console.error("Error generating booking PDF:", error);
            return res.status(500).json({
                success: false,
                message: "An error occurred while generating the PDF.",
            });
        }
    }
});

export const spaceOwnerGetBanksAndSavedAccount = asyncHandler(async (req, res) => {
    console.log("Getting all banks".yellow)
    console.log("User", req.user._id)
    try {
        const response = await axios.get('https://api.paystack.co/bank', {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`
            }
        });

        const userSavedBankDetails = await BankDetails.find({ user: req.user._id });

        const formattedUserSavedBankAccounts = userSavedBankDetails.flatMap(bankDetail => 
            bankDetail.banks.map(bank => ({
                id: bank.id,
                bankName: bank.bankName,
                accountNumber: bank.accountNumber,
                accountName: bank.accountName,
                recipientCode: bank.recipientCode
            }))
        );

        // console.log("Banks", formattedUserSavedBankAccounts);

        const { status, data } = response.data;

        const formattedPaystackBanks = data.map(bank => ({
            id: bank.id,
            name: bank.name,
            code: bank.code
        }));

        

        if (status) {
            console.log("Bank list retrieved successfully".blue)
            return res.status(200).json({
                success: true,
                message: "Bank list retrieved successfully",
                data: {
                    userSavedBankAccounts: formattedUserSavedBankAccounts,
                    allBanks: formattedPaystackBanks
                }
            });
        } else {
            console.log("Failed to retrieve bank list".red)
            return res.status(400).json({
                success: false,
                message: "Failed to retrieve bank list"
            });
        }

    } catch (error) {
        console.error("Error fetching bank list", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving the bank list"
        });
    }
});

export const spaceOwnerVerifyAccountNumber = asyncHandler(async (req, res) => {
    console.log("User verifying account number".blue)

    const { account_number, bank_code } = req.body;

    try {
        const response = await axios.get(`https://api.paystack.co/bank/resolve`, {
            params: {
                account_number,
                bank_code
            },
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`
            }
        });

        const { status, data } = response.data;

        if (status) {
            console.log("Account name successfully retrieved: ", data.account_name);
            return res.status(200).json({
                success: true,
                message: "Bank details verified successfully",
                account_name: data.account_name
            });
        } else {
            console.log(`Failed to verify bank details: ${data.message}`);
            return res.status(400).json({
                success: false,
                message: `Failed to verify bank details: ${data.message}`
            });
        }
    } catch (error) {
        // Handle the error message and extract the response message
        if (error.response && error.response.data && error.response.data.message) {
            console.error(error.response.data.message);
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data.message  // Extract the specific error message from Paystack
            });
        } else {
            // For unexpected errors
            console.error("Unexpected error verifying bank details", error);
            return res.status(500).json({
                success: false,
                message: "An unexpected error occurred while verifying bank details"
            });
        }
    }
});

export const spaceOwnerSaveNewAccountDetails = asyncHandler(async (req, res) => {
    console.log("User adding new account details for withdrawal".blue);

    const userId = req.user._id;

    const existingUser = await User.findById(userId);

    if (!existingUser) {
        console.log("User not found".red);
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    const { account_number, bank_code } = req.body;

    if (!bank_code || !account_number) {
        console.log("Bank code and account number are required before saving new bank details");
        return res.status(500).json({
            success: false,
            message: "Bank code and account number are required before saving new bank details"
        });
    }

    // Check if the entered accountexists in the list of accounts fr that user first
    let bankDetails = await BankDetails.findOne({ user: userId });
    if(bankDetails) {
        const existingAccount = bankDetails.banks.some(bank => bank.accountNumber === account_number);
    
        if (existingAccount) {
            console.log("Bank account already exists in the list of saved banks".red);
            return res.status(400).json({ success: false, message: 'Bank account already exists in the list of saved banks' });
        }
    }

    // call paystack resolve to get account name
    try {
        const response = await axios.get(`https://api.paystack.co/bank/resolve`, {
            params: {
                account_number: account_number,
                bank_code: bank_code
            },
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`
            }
        });

        const { status: resolve_status, data: resolve_data } = response.data;

        // Ensure that Paystack returns valid data
        if (resolve_status && resolve_data) {

            console.log("Creating new transfer recipient".green) //Create new transfer recipient for the user
            const transfer_recipient_response = await axios.post(
                `https://api.paystack.co/transferrecipient`, 
                {
                    type: "nuban",
                    name: resolve_data.account_name,
                    account_number: resolve_data.account_number,
                    bank_code: bank_code,
                    currency: "NGN",
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`,
                    }
                }
            );
    
            const { status: recipient_status, data:recipient_data } = transfer_recipient_response.data;
            
            if(recipient_status && recipient_data){
                console.log("New transfer recipient successfully created", recipient_data.recipient_code)
    
                    // Push new bank details into the array
                    if(bankDetails) {
                        bankDetails.banks.push({
                            bankName: recipient_data.details.bank_name,
                            accountNumber: recipient_data.details.account_number,
                            accountName: recipient_data.details.account_name,
                            bankCode: recipient_data.details.bank_code,
                            recipientCode: recipient_data.recipient_code
                        });

                        await bankDetails.save()

                        console.log("Successfully added a new bank details to the list of banks".rainbow)
                        return res.status(200).json({
                            success: true,
                            message: "Successfully added a new bank details to the list of banks"
                        })
                    } else {
                        bankDetails = new BankDetails ({
                            user: userId,
                            banks: {
                                bankName: recipient_data.details.bank_name,
                                accountNumber: recipient_data.details.account_number,
                                accountName: recipient_data.details.account_name,
                                bankCode: recipient_data.details.bank_code,
                                recipientCode: recipient_data.recipient_code
                            }
                        })
                        await bankDetails.save()

                        console.log("New bank account successfully saved".rainbow)

                        return res.status(200).json({
                            success: true,
                            message: "New bank account successfully saved",
                            data: bankDetails
                        })
                    }
                    
                } else {
                    console.log("Error generating reciepint code".red)
                    return res.status(400).json({
                        success: false,
                        message: "Error generating reciepint code"
                    });
                
            }
        } else {
            console.log("Error verifying account number".red)
            return res.status(400).json({
                success: false,
                message: "Error verifying account number"
            });
        }
    } catch (error) {
        console.error("Error verifying bank details", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while verifying bank details"
        });
    }
});

export const spaceOwnerInitiateWithdrawal = async (req, res) => {

    console.log("Space owner Initiating withdrawal".blue);
    const { withdrawal_amount, recipient_code } = req.body;

    if (!withdrawal_amount || !recipient_code) {
        console.log("Withdrawal amount and recipient codes are required".red);
        return res.status(400).json({
            success: false,
            message: "Withdrawal amount and recipient codes are required"
        });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
        console.log("Wallet not found".red);
        return res.status(404).json({
            success: false,
            message: "Wallet not found"
        });
    }

    if (wallet.currentBalance < withdrawal_amount) {
        console.log(`Insufficient wallet balance. Current balance is ${formatAmount(wallet.currentBalance)}`.red);
        return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance. Current balance is ${formatAmount(wallet.currentBalance)}`
        });
    }

    const bankDetails = await BankDetails.findOne({ "banks.recipientCode": recipient_code });

    if (!bankDetails) {
        console.log("The bank being withdrawn to cannot be found".red);
        return res.status(404).json({
            success: false,
            message: "The bank being withdrawn to cannot be found"
        });
    }

    const matchingBank = bankDetails.banks.find(bank => bank.recipientCode === recipient_code);

    if (!matchingBank) {
        console.log("The bank being withdrawn to cannot be found".red);
        return res.status(404).json({
            success: false,
            message: "The bank being withdrawn to cannot be found"
        });
    }

    try {
        // Create a new withdrawal record
        const newWithdrawal = new Withdrawal({
            user: req.user._id,
            methodOfWithdrawal: "paystack",
            withdrawalAmount: withdrawal_amount,
            status: "pending",
            accountNumberWithdrawnTo: matchingBank.accountNumber,
            bankNameWithdrawnTo: matchingBank.bankName,
            recipient_code: recipient_code,
            reason: "Withdrawal from wallet"
        });

        await newWithdrawal.save();

        // Update wallet balance
        wallet.totalWithdrawn = Number(wallet.totalWithdrawn || 0);
        const withdrawalAmountInNaira = Number(withdrawal_amount);

        wallet.currentBalance -= withdrawalAmountInNaira;
        wallet.totalWithdrawn += withdrawalAmountInNaira;
        await wallet.save();

        // Use `_id` to find the specific withdrawal created
        const latestWithdrawal = await Withdrawal.findById(newWithdrawal._id).populate('user');

        if (!latestWithdrawal) {
            console.log("Can't find latest withdrawal".red);
            return res.status(500).json({
                success: false,
                message: "Can't find latest withdrawal"
            });
        }

        function maskNumber(number) {
            if (!number || typeof number !== "string") {
                return "******"; // Return a placeholder if the number is invalid
            }
            const maskedPart = "*".repeat(number.length - 4); // Generate asterisks for all but the last 4 digits
            const visiblePart = number.slice(-4); // Get the last 4 digits
            return maskedPart + visiblePart; // Combine masked and visible parts
        }

        // Format the response
        const formattedWithdrawal = {
            user: req.user._id,
            transactionId: latestWithdrawal.transactionId,
            methodOfWithdrawal: latestWithdrawal.methodOfWithdrawal,
            accountNumberWithdrawnTo: maskNumber(latestWithdrawal.accountNumberWithdrawnTo),
            userEmail: latestWithdrawal.user.email,
            withdrawalAmount: latestWithdrawal.withdrawalAmount,
            status: latestWithdrawal.status,
            bankNameWithdrawnTo: latestWithdrawal.bankNameWithdrawnTo,
            recipient_code: latestWithdrawal.recipient_code,
            reason: latestWithdrawal.reason
        };

        console.log("Withdrawal successful".rainbow);
        return res.status(200).json({
            success: true,
            message: `You have successfully requested for withdrawal for a total amount of #${formatAmount(withdrawal_amount)} which is currently pending and you're expected to receive the funds within 24 hours`,
            withdrawal: formattedWithdrawal
        });
    } catch (error) {
        console.error("Error during withdrawal process:", error);
        res.status(500).json({
            success: false,
            message: error.message || "An error occurred during the withdrawal process"
        });
    }
};


// 
let paystackKey;
if(process.env.NODE_ENV === "development"){
    paystackKey = process.env.PAYSTACK_TEST_SECRET_KEY
} else {
    paystackKey = process.env.PAYSTACK_LIVE_SECRET_KEY
}

                                                 //  SPACE USERS WALLET TAB
export const spaceUserGetWallet = asyncHandler(async(req, res) => {
    console.log("Space user get wallet endpoint".blue)

    const user_id = req.user._id

    const existing_user = await User.findOne(user_id)

    if (!existing_user) {
        console.log("User does not exist".red);
        return res.status(404).json({
            success: false,
            message: "User does not exist"
        });
    }

    let walletMetrics = await Wallet.findOne({user: user_id})

    if(!walletMetrics) {
        const newWallet = new Wallet({
            user: user_id,
            current_balance: 0,
            total_withdrawn: 0,
            total_earned: 0
        })
        await newWallet.save()
        walletMetrics = newWallet
    }

    const updatedWalletMetrics = await Wallet.findOne({ user: user_id });

    const formattedWallet = {
        walletBalance: updatedWalletMetrics.currentBalance,
        allTimeFunding: updatedWalletMetrics.allTimeFunding
    }

    console.log("Space user wallet dashboard successfully retrieved".rainbow)
    return res.status(200).json({
        success: true,
        message: "Space user wallet dashboard successfully retrieved",
        data: {
            walletMetrics: formattedWallet
        }
    })
})

export const getTransactionsForSpaceUsersWallet = asyncHandler(async (req, res) => {
    console.log("Getting transaction history for space users".blue);
    const user_id = req.user._id; 

    const { filter } = req.query
    console.log("Filter: ", filter)

    try {
        let bookings;
        let refunds;
        let topUps;

        if(filter === "bookings") {
            bookings = await Booking.find({ user: user_id }).populate("listing").sort({ createdAt: -1 });

            if(!bookings || bookings.lenght < 1 ) {
                console.log("No booking history available at the moment".red)
                return res.status(200).json({
                    success: true,
                    message: "No booking history available at the moment"
                })
            }

            const formattedBookings = bookings.map((booking) => ({
                id: booking._id,
                invoiceId: booking.invoiceId,
                bookingId: booking.invoiceId,
                date: formatDateForSUTransactionHistory(booking.updatedAt),  
                spaceName: booking.listing?.propertyName || "null",
                totalNights: booking.bookedDays.length,
                chargePerNight: booking.listing.chargePerNight,
                amount: booking.chargePerNight * booking.bookedDays.length,
                paymentMethod: booking.paymentType,
                paymentStatus: booking.paymentStatus
            }));

            console.log("All bookings returned".cyan)
            return res.status(200).json({
                success: true,
                message: "Bookings wallet transactions successfully retrieved",
                totalBookings: bookings.length,
                data: formattedBookings
            });
        }

        if(filter === "topUps") {
            topUps = await FundingHistory.find({ user: req.user._id }).sort({ createdAt: -1 });

            if(!topUps || topUps.lenght < 1 ) {
                console.log("No top up history available at the moment".red)
                return res.status(200).json({
                    success: true,
                    message: "No top up history available at the moment"
                })
            }

            const formattedFundingHistory = topUps.map((topUp) => ({
                id: topUp._id,
                topUpId: topUp.invoiceId,
                transactionId: topUp.invoiceId,
                date: formatDateForSUTransactionHistory(topUp.updatedAt),
                amount: topUp.amount_to_fund,
                paymentMethod: topUp.mode_of_funding,
                paymentStatus: topUp.payment_status
            }));

            console.log("All wallet fundings returned".cyan)
            return res.status(200).json({
                success: true,
                message: "All wallet fundings successfully retrieved",
                totalBookings: topUps.length,
                data: formattedFundingHistory
            });
        }
        
        if(filter === "refunds") {

            console.log("No refund available at the moment".red)
            return res.status(500).json({
                success: false,
                message: "No refund available at the moment",
                data: null
            })
            // topUps = await FundingHistory.find({ user: req.user._id }).sort({ createdAt: -1 });

            // if(!topUps || topUps.lenght < 1 ) {
            //     console.log("No top up history available at the moment".red)
            //     return res.status(200).json({
            //         success: true,
            //         message: "No top up history available at the moment"
            //     })
            // }

            // const formattedFundingHistory = topUps.map((topUp) => ({
            //     id: topUp._id,
            //     topUpId: topUp.invoiceId,
            //     transactionId: topUp.invoiceId,
            //     date: formatDateForSUTransactionHistory(topUp.updatedAt),
            //     amount: topUp.amount_to_fund,
            //     paymentMethod: topUp.mode_of_funding,
            //     paymentStatus: topUp.payment_status
            // }));

            // console.log("All wallet fundings returned".cyan)
            // return res.status(200).json({
            //     success: true,
            //     message: "All wallet fundings successfully retrieved",
            //     totalBookings: topUps.length,
            //     data: formattedFundingHistory
            // });
        }else {
            console.log("Invalid filter provided")
            return res.status(500).json({
                success: false,
                message: "Invalid filter provided"
            })
        }

    } catch (error) {   
        console.error("Error retrieving transactions: ", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving transactions",
            error: error.message
        });
    }
});

//GET    "/su-get-single-wallet-transaction
export const spaceUserGetSingleTransactionDetails = asyncHandler(async (req, res) => {
    console.log("Getting a single wallet transaction details for space user".green);

    try {
        const { transactionId } = req.query;

        console.log(`Transaction ID: ${transactionId}`.blue);

        const booking = await Booking.findById(transactionId).populate("listing")

        if(!booking) {
            console.log("Not found in booking, looking through funding".yellow)

            const funding = await FundingHistory.findById(transactionId)

            if(!funding) {
                console.log("Transaction does not exist".red)
                return res.status(200).json({
                    success: true,
                    message: "No transaction found"
                })
            }

            const formattedTransaction = {
                invoiceId: funding.invoiceId,
                date: formatDate(funding.updatedAt),
                paymentMethod: funding.paymentMethod,
                amount: funding.amount_to_fund,
            }

            console.log("Transaction retrieved successfully".cyan)
            return res.status(200).json({
                success: true,
                message: "Transaction successfully retrieved",
                data: formattedTransaction
            })

        }

        const formattedBookingTransaction = {
            invoiceId: booking.invoiceId,
            date: formatDate(booking.updatedAt),
            propertyName: booking.listing.propertyName,
            paymentMethod: booking.paymentType,
            amount: booking.totalIncuredChargeAfterDiscount,
            totalNights: booking.totalNight,
        }

        console.log("Transaction retrieved successfully".cyan)
        return res.status(200).json({
            success: true,
            message: "Transaction successfully retrieved",
            data: formattedBookingTransaction
        })

    } catch (error) {
        console.error("Error fetching transaction details:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching transaction details",
            error: error.message
        });
    }
});


export const spaceUserInitialiseFundWallet = async (req, res) => {
    console.log("Initializing Paystack payment for wallet funding...".green);
    const { amount, callBackUrl } = req.body;
    const user_id = req.user._id
    const email = req.user.email

    const requiredFields = {
        amount,
        callBackUrl, 
        user_id, 
        email
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

    const amountInKobo = amount * 100;

    try {
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amountInKobo,
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

        console.log("Response: ", response.data)

        const call_back_with_reference = `${callBackUrl}?reference=${reference}`;

        let wallet;

        wallet = await Wallet.findOne({user: user_id})
        if(!wallet) {
            console.log("Creating new wallet for user".yellow)
            wallet = new Wallet({
                user: user_id,
                currentBalance: 0,  
                totalWithdrawn: 0, 
                totalEarned: 0,
                allTimeFunding: 0
            });
        
            // Save the newly created wallet to the database
            await wallet.save();
            console.log("New wallet created for user".green);
        }

        const newFunding = await FundingHistory.create({
            user: user_id,
            display_image: "https://asset.cloudinary.com/dyshmmjis/d8e05916c710840313af682f1e9919ac",
            amount_to_fund: amount,
            payment_status: "pending",
            mode_of_funding: "web-payment",
            current_balance_before_funding: wallet.currentBalance,
            current_balance_after_funding: wallet.currentBalance + amount,
            all_time_wallet_funding: wallet.allTimeFunding + amount,
            authorization_url: authorization_url,
            access_code: access_code,
            paystack_ref: reference,
        })

        await newFunding.save()
    
        console.log(`Wallet funding transaction initialized for total amount of ${amount}`)
        res.status(200).json({
            success: true,
            message: `Wallet funding transaction initialized for total amount of ${amount}`,
            data: {
                authorization_url,
                access_code,
                reference,
                call_back_with_reference,
                amount: amount
            },
        });
    } catch (error) {
        console.error("Wallet funding transaction failed:", error.message);
        res.status(500).json({
            success: false,
            message: 'Wallet funding transaction failed', error,
        });
    }
};
export const spaceUserVerifyWalletFunding = async (req, res) => {
    const { reference } = req.body;  

    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`
            }
        });

        const { status: paystackStatus, amount: paystackKoboAmount, customer } = response.data.data;

        if (paystackStatus !== 'success') {
            console.log("Payment failed".red);
            return res.status(400).json({
                success: false,
                message: 'Payment was not successful.',
            });
        }

        if (paystackStatus && paystackStatus === 'success') {
            console.log(response.data);
            const formattedPaystackResponse = {
                message: response.data.message,
                status: response.data.data.status,
                reference: response.data.data.reference,
                amount: response.data.data.amount,
                transaction_message: response.data.data.message,
                paid_at: response.data.data.paid_at,
                created_at: response.data.data.created_at,
                fees: response.data.data.fees,
                authorization_code: response.data.data.authorization.authorization_code,
                bank: response.data.data.authorization.bank,
                country_code: response.data.data.authorization.country_code,
                brand: response.data.data.authorization.brand,
                account_name: response.data.data.authorization.account_name,
                transaction_date: response.data.data.transaction_date
            };

            const fundinghistory = await FundingHistory.findOne({ paystack_ref: reference });
            if (!fundinghistory) {
                console.log("Payment was successful, but the funding history was not found in the database".red);
                return res.status(404).json({
                    success: false,
                    message: 'Payment was successful, but the funding history was not found.',
                });
            }

            if (fundinghistory.payment_status === 'successful') {
                console.log("Transaction has already been verified as successful".bgRed);
                return res.status(400).json({
                    success: false,
                    message: 'Transaction has already been verified as successful.',
                });
            }

            fundinghistory.payment_status = "successful";
            await fundinghistory.save()

            const existing_user = await User.findOne({ email: req.user.email });
            if (!existing_user) {
                console.log("User who initiated this transaction can't be found again".red);
                return res.status(500).json({
                    success: false,
                    message: "User who initiated this transaction can't be found again"
                });
            }

            const wallet = await Wallet.findOne({ user: req.user._id });
            wallet.currentBalance += (paystackKoboAmount / 100);  // Corrected line
            wallet.allTimeFunding += (paystackKoboAmount / 100);  // Corrected line
            await wallet.save();
            
            const formattedRes = {
                current_balance: wallet.currentBalance,
                all_time_funding: wallet.allTimeFunding
            }

            console.log("Payment verified and wallet updated successfully".rainbow);
            return res.status(200).json({
                success: true,
                message: "Payment verified and wallet updated successfully",
                wallet: formattedRes
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });
        }

    } catch (error) {
        console.error("Error verifying payment", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while verifying payment"
        });
    }
};
