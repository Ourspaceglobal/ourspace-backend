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
                availableBalance: walletBalance.currentBalance,
                totalEarning: walletBalance.totalEarned
            }

            if (walletTab === 'bookings' || !walletTab) { 
                console.log(`Fetching data for user ID ${userId} with filter ${filter} under ${walletTab}`.green);
                const walletBookings = await Booking.find({ user: userId });

                if (walletBookings.length < 1) {
                    console.log("No bookings found at the moment".red);
                    return res.status(200).json({
                        success: true,
                        message: "No bookings found at the moment",
                        data: {
                            wallet: formattedWalletBalance,
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
                        bookings: formattedWalletBookings
                    }
                });
            } else if (walletTab === 'wallet-transactions') {
                console.log(`Fetching data for user ID ${userId} with filter ${filter} under ${walletTab}`.green);
            
                // Fetch wallet transactions and bookings with completed payment status
                const walletTransactions = await Withdrawal.find({ user: userId }).sort({ createdAt: -1 });
                const fundinghistory = await FundingHistory.find({ user: userId }).sort({ createdAt: -1 })
                const SUBookings = await Booking.find({ user: userId, paymentStatus: "completed" }).populate("listing").sort({ createdAt: -1 });
                const SOBookings = await Booking.find({ spaceOwnerId: userId, paymentStatus: "completed" }).populate("listing").sort({ createdAt: -1 });

            
                // If no wallet transactions and no bookings, return early
                if (walletTransactions.length < 1 && SUBookings.length < 1 && SOBookings.length < 1 && fundinghistory.length < 1) {
                    console.log("No wallet transactions or bookings found at the moment".red);
                    return res.status(200).json({
                        success: true,
                        message: "No wallet transactions or bookings found at the moment",
                        data: [],
                    });
                }
            
                // Format wallet transactions FOR SPACE OWNERS WITHDRAWAL
                const formattedWalletTransactions = walletTransactions.map((transaction) => ({
                    type: 'debit',
                    reason: "wallet-withdrawal",
                    id: transaction._id,
                    invoiceId: `#${transaction.paystack_id}`,
                    amount: transaction.amount,
                    date: formatDate(transaction.createdAt),
                }));
            
                // Format funbding history for space users 
                const formattedFundingHistory = fundinghistory.map((funding) => ({
                    type: 'credit',
                    reason: "wallet-funding",
                    id: funding._id,
                    invoiceId: `#${funding.invoiceId}`,
                    amount: funding.amount_to_fund,
                    date: formatDate(funding.createdAt),
                }));
                
                // Format bookings for space user 
                const formattedSUBookings = SUBookings.map((booking) => ({
                    type: 'credit',
                    reason: "Payment SU makes for property Bookings",
                    id: booking._id,
                    invoiceId: booking.invoiceId,
                    amount: booking.totalIncuredChargeAfterDiscount * booking.bookedDays.length,
                    date: formatDate(booking.createdAt),
                }));

                // Bookings for space owners for their listing paid by space users
                const formattedSOBookings = SOBookings.map((booking) => ({
                    type: 'credit',
                    reason: "SU Bookings payment",
                    id: booking._id,
                    invoiceId: booking.invoiceId,
                    amount: booking.totalIncuredChargeAfterDiscount * booking.bookedDays.length,
                    date: formatDate(booking.createdAt),
                }));

            
                // Combine both formatted transactions and bookings
                const combinedData = [...formattedWalletTransactions, ...formattedSUBookings, ...formattedSOBookings, ...formattedFundingHistory];
            
                // Sort the combined data by 'date' (createdAt) in descending order
                const sortedCombinedData = combinedData.sort((a, b) => new Date(b.date) - new Date(a.date));
            
                console.log(`Total of ${sortedCombinedData} wallet transaction history and bookings successfully retrieved for the user`.rainbow);
                return res.status(200).json({
                    success: true,
                    message: "Wallet transactions and bookings retrieved successfully",
                    total: sortedCombinedData.length,
                    data: sortedCombinedData,
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

const adminChangeUserRole = asyncHandler(async (req, res) => {
    console.log("Admin changing user role".cyan);
  
    const { userId, newRole } = req.body;
  
    try {
      // Check if the current user is an admin
      if (!req.user.isAdmin) {
        console.log("Only admins can change user roles".red);
        return res.status(401).json({
          success: false,
          message: "Only admins can change user roles",
        });
      }
  
      // Ensure that the `newRole` is valid
      const validRoles = ["user", "admin", "super-admin"];
      if (!validRoles.includes(newRole)) {
        console.log("Invalid role provided".red);
        return res.status(400).json({
          success: false,
          message: "Invalid role. Role must be one of: user, admin, super-admin",
        });
      }
  
      // Find the user whose role needs to be changed
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        console.log("The user for which the role is to be changed does not exist".red);
        return res.status(404).json({
          success: false,
          message: "The user for which the role is to be changed does not exist",
        });
      }
  
      // Update the user's role and isAdmin status based on newRole
      if (newRole === "user") {
        existingUser.isAdmin = false;
      } else {
        existingUser.isAdmin = true;
      }
      existingUser.role = newRole;
  
      await existingUser.save();
  
      console.log(`User role changed successfully to ${newRole}`.green);
      return res.status(200).json({
        success: true,
        message: `User role updated to ${newRole}`,
        data: {
          userId: existingUser._id,
          newRole: existingUser.role,
        },
      });
    } catch (error) {
      console.error("Error changing user role:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while changing the user role",
        error: error.message,
      });
    }
  });
  
  
export {
    getAllUsers,
    getUserData,
    editProfileInfo,
    editUserAccountStatus,
    deleteUserAccount,
    adminChangeUserRole
}