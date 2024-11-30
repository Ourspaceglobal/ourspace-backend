import express from "express";
import { adminRequestWithdrawalOtpFromPaystack, approveWithdrawal, getAllPayouts, getPayoutById, rejectWithdrawal } from "../../controllers/adminCtrls/payoutCtrlr.js";
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

//
router.
route('/withdrawal-webhook')
.post(approveWithdrawal);

//
router.
route('/reject-withdrawal')
.post(protect, admin, rejectWithdrawal);

export default router;