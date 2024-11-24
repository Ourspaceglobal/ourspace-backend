import express from "express";
import { adminRequestWithdrawalOtpFromPaystack, approveWithdrawal, getAllPayouts, getPayoutById } from "../../controllers/adminCtrls/payoutCtrlr.js";
import { admin, protect } from "../../middleware/authMiddleware.js";

const router = express.Router();

router
.route("/get-all-payouts")
.get(protect, admin, getAllPayouts)

//
router.
route('/:id')
.get(protect, admin, getPayoutById);

//
router.
route('/request-paystack-otp')
.post(protect, admin, adminRequestWithdrawalOtpFromPaystack);

//
router.
route('/approve-withdrawal')
.post(protect, admin, approveWithdrawal);

export default router;