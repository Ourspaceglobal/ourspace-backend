import express from "express";
import { adjustRealChargePerNight, checkAvailability, getBookingsForListingId, initializeTransaction, verifyTransaction } from "../controllers/bookingCtrlr.js";
import { protect } from "../middleware/authMiddleware.js";

const router  = express.Router()

router.route("/check-availability/:listingId").post(checkAvailability)

router.route("/paystack/initialise").post(protect, initializeTransaction)
router.route("/paystack/verify").post(protect, verifyTransaction)

router
.route("/specific-listing-bookings/:listingId")
.get(protect, getBookingsForListingId)

router
.route("/adjust")
.patch(protect, adjustRealChargePerNight)

export default router 
