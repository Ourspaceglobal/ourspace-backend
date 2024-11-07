import asyncHandler from "../../middleware/asyncHandler.js"
import Booking from "../../models/bookingModel.js";
import FundingHistory from "../../models/fundingModel.js";
import User from "../../models/userModel.js"
import Wallet from "../../models/walletModel.js";
import Withdrawal from "../../models/withdrawalRequestModel.js";
import { formatDate } from "../../utils/helperFunction.js";

const getAllUsers = asyncHandler(async (req, res) => {
    console.log("Getting all users...".yellow);

    // Extract userType from query parameters
    const { userType } = req.query;
    let filter = {};

    // Apply filter if userType is provided
    if (userType) {
        if (["space-user", "space-owner"].includes(userType)) {
            filter.userType = userType;
            console.log(`Filtering users by userType: ${userType}`.cyan);
        } else {
            console.log(`Invalid userType provided: ${userType}`.red);
            return res.status(400).json({
                success: false,
                message: "Invalid userType provided. Must be 'space-user' or 'space-owner'."
            });
        }
    }

    try {
        const users = await User.find(filter);

        const formattedUsers = users.map((user) => ({
            id: user._id,
            email: user.email,
            type: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            status: "active",
            date: formatDate(user.createdAt)
        }))

        console.log(`Total of ${users.length} users successfully retrieved`.america);
        res.status(200).json({
            success: true,
            message: `Total of ${users.length} users successfully retrieved`,
            total: users.length,
            data: formattedUsers
        });

    } catch (err) {
        console.log(`Error retrieving users: ${err.message}`.red);
        res.status(400).json({
            success: false,
            message: `Error getting users: ${err.message || err}`,
        });
    }
});

const getUserData = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { filter, walletTab } = req.query; // `walletTab` for wallet-specific sub-filters

    console.log(`Fetching data for user ID ${userId} with filter ${filter}`.yellow);

    let spaceOwner;

    try {
        // User info filter
        if (!filter || filter === 'user-info') {
            spaceOwner = await User.findById(userId);
            if (!spaceOwner) {
                console.log("No user found".red);
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            console.log("User successfully retrieved".rainbow);
            return res.status(200).json({
                success: true,
                message: "User info retrieved successfully",
                data: spaceOwner,
            });
        }

        // Bookings filter
        if (filter === 'bookings') {
            const bookings = await Booking.find({ user: userId }).populate('listing').populate('user').sort({ updatedAt: -1 });
            if (bookings.length < 1) {
                console.log("No booking found at the moment".red);
                return res.status(200).json({
                    success: true,
                    message: "No booking history found at the moment",
                    data: bookings
                });
            }

            const spaceOwner = await User.findById(userId)

            console.log("Space-owner", spaceOwner)

            

            const formattedBookings = bookings.map((booking) => {
                const listing = booking.listing || {};
                return {
                    id: booking._id,
                    invoiceId: booking.invoiceId,
                    spaceOwnerName: spaceOwner.firstName,
                    spaceUserName: booking.user?.lastName || 'N/A',
                    spaceName: listing.propertyName || "Unknown Property",
                    status: booking.paymentStatus,
                    amount: booking.totalIncuredChargeAfterDiscount,
                    date: formatDate(booking.updatedAt),
                };
            });

            console.log("Bookings successfully retrieved for a user by admin".rainbow);
            return res.status(200).json({
                success: true,
                message: "User bookings retrieved successfully",
                total: bookings.length,
                data: formattedBookings,
            });
        }

        // Wallet filter
        if (filter === 'wallet') {
            const walletBalance = await Wallet.findOne({ user: userId });

            const formattedWalletBalance = {
                userId: walletBalance.user,
                currentBalance: walletBalance.currentBalance
            }

            if (walletTab === 'bookings' || !walletTab) { 
                console.log(`Fetching data for user ID ${userId} with filter ${filter} under ${walletTab}`.green);
                const walletBookings = await Booking.find({ user: userId }); // Assuming `WalletMetrics` is your collection for metrics
                if (walletBookings.length < 1) {
                    console.log("No bookings found at the moment".red);
                    return res.status(200).json({
                        success: true,
                        message: "No bookings found at the moment",
                        data: {
                            walletMetrics: formattedWalletBalance,
                            bookings: walletBookings
                        }
                    });
                }

                const formattedWalletBookings = walletBookings.map((walletBooking) => ({
                    id: walletBooking._id,
                    invoiceId: walletBooking.invoiceId,
                    date: walletBooking.updatedAt,
                    description: "Booking",
                    amount: walletBooking.totalIncuredChargeAfterDiscount,
                    paymentMethod: walletBooking.paymentType,
                    paymentStatus: walletBooking.paymentStatus
                }))

                console.log("Wallet dashboard successfully retrieved for a user by admin".rainbow);
                return res.status(200).json({
                    success: true,
                    message: "Wallet dashboard retrieved successfully",
                    data: {
                        walletMetrics: formattedWalletBalance,
                        bookings: formattedWalletBookings
                    }
                });
            } else if (walletTab === 'wallet-transactions') {
                console.log(`Fetching data for user ID ${userId} with filter ${filter} under ${walletTab}`.green);
                const walletTransactions = await Withdrawal.find({ user: userId }).sort({ updatedAt: -1 });

                if (walletTransactions.length < 1) {
                    console.log("No wallet transaction history found at the moment".red);
                    return res.status(200).json({
                        success: true,
                        message: "No wallet transaction history found at the moment",
                        data: walletTransactions
                    });
                }

                const formattedTransactions = walletTransactions.map((transaction) => ({
                    id: transaction._id,
                    invoiceId: `#${transaction.paystack_id}`,
                    amount: transaction.amount,
                    reason: transaction.reason,
                    status: transaction.status,
                    date: formatDate(transaction.updatedAt),
                }));

                console.log("Wallet transaction history successfully retrieved for a user by admin".rainbow);
                return res.status(200).json({
                    success: true,
                    message: "Wallet transactions retrieved successfully",
                    total: walletTransactions.length,
                    data: formattedTransactions,
                });
            }

            console.log("Invalid wallet tab selected".red);
            return res.status(400).json({
                success: false,
                message: `Invalid wallet tab value.`,
            });
        }

        console.log("Invalid filter selected".red);
        return res.status(400).json({
            success: false,
            message: `Invalid filter value. Use 'user-info', 'bookings', or 'wallet'.`,
        });

    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving data",
            error: error.message,
        });
    }
});


const editProfileInfo = asyncHandler(async (req, res) => {
    console.log("Editing profile information".yellow);

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const {
            firstName,
            lastName,
            email,
            gender,
            dateOfBirth,
            mobileNumber,
            country,
            state,
            city,
            homeAddress,
            phoneNumber,
        } = req.body;

        // Update fields only if they are provided in the request
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email;
        if (gender) user.gender = gender;
        if (dateOfBirth) user.dateOfBirth = dateOfBirth;
        if (mobileNumber) user.mobileNumber = mobileNumber;
        if (country) user.country = country;
        if (state) user.state = state;
        if (city) user.city = city;
        if (homeAddress) user.homeAddress = homeAddress;
        if (phoneNumber) user.phoneNumber = phoneNumber;

        // Handle profile picture upload
        if (req.file) {
            const profilePicUrl = await uploadProfileImageToCloudinary(req.file);
            user.profilePic = profilePicUrl;
        }

        await user.save();

        // Exclude the password field from the user object
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        console.log(`Profile information updated for user ID: ${req.user._id}`.green);
        res.status(200).json({
            success: true,
            message: "Profile information updated successfully",
            user: userWithoutPassword,
        });

    } catch (error) {
        console.error("Error updating profile information:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating profile information",
        });
    }
});

const editUserAccountStatus = asyncHandler(async (req, res) => {
    console.log("Editing user account status".yellow);

    try {
        const userId = req.params.id;
        const { status } = req.body;

        // Define the list of valid statuses
        const validStatuses = ['active', 'inactive', 'suspended', 'blocked'];

        // Check if the provided status is valid
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        // Find the user by ID and update the status
        const user = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: true, runValidators: true } // Return the updated document and validate before updating
        );

        if (!user) {
            console.log(`Error updating user`.red);
            res.status(200).json({
                success: true,
                message: `Error updating user`,
            });
        }

        console.log(`User successfully updated`.america);
        res.status(200).json({
            success: true,
            message: `User successfully updated`,
            data: user
        });
    } catch (error) {
        console.error("Error updating user account status:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

const deleteUserAccount = asyncHandler(async (req, res) => {
    console.log("Deleting user account".red);

    try {
        const userId = req.params.id;

        // Find the user by ID and delete the account
        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            message: "User account deleted successfully",
            user: user // Optional: return the deleted user's data
        });
    } catch (error) {
        console.error("Error deleting user account:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});



export {
    getAllUsers,
    getUserData,
    editProfileInfo,
    editUserAccountStatus,
    deleteUserAccount
}