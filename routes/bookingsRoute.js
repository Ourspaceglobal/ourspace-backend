import express from "express";
import { bookWithWallet, checkAvailability, spaceOwnerFetchBookingHistoryForALisitng, initializeTransaction, verifyTransaction } from "../controllers/bookingCtrlr.js";
import { protect, spaceOwner, spaceUser } from "../middleware/authMiddleware.js";
import { cancelBooking } from "../controllers/profileCtrlr.js";

const router  = express.Router()

router.route("/check-availability/:listingId").post(checkAvailability)

router.route("/paystack/initialise").post(protect, spaceUser, initializeTransaction)
router.route("/paystack/verify").post(protect, spaceUser, verifyTransaction)


router
.route("/book-with-wallet")
.post(protect, spaceUser, bookWithWallet)

router
.route("/specific-listing-bookings/:listingId")
.post(protect, spaceOwner, spaceOwnerFetchBookingHistoryForALisitng)

export default router 
