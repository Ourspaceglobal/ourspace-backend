import express from "express";
import { bookWithWallet, checkAvailability, spaceOwnerFetchBookingHistoryForALisitng, initializeTransaction, verifyTransaction } from "../controllers/bookingCtrlr.js";
import { protect } from "../middleware/authMiddleware.js";

const router  = express.Router()

router.route("/check-availability/:listingId").post(checkAvailability)

router.route("/paystack/initialise").post(protect, initializeTransaction)
router.route("/paystack/verify").post(protect, verifyTransaction)


router
.route("/book-with-wallet")
.post(protect, bookWithWallet)


router
.route("/specific-listing-bookings/:listingId")
.post(protect, spaceOwnerFetchBookingHistoryForALisitng)

export default router 
