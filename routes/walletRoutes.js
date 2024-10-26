import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { downloadBookingPDF, getTransactionsForSpaceUsersWallet, initiateWithdrawal, soGetSingleBookingFromWalletDashboard, spaceOwnerGetBanksAndSavedAccount, spaceOwnerGetWallet, spaceOwnerSaveNewAccountDetails, spaceOwnerVerifyAccountNumber, spaceUserGetWallet, spaceUserInitialiseFundWallet, spaceUserVerifyWalletFunding } from "../controllers/walletController.js";

const router = express.Router()


router
.route("/so-get-wallet-dashboard")
.get(protect, spaceOwnerGetWallet)

router
.route("/so-view-payment-invoice")
.get(protect, soGetSingleBookingFromWalletDashboard)

router
.route("/so-download-invoice-as-pdf")
.get(protect, downloadBookingPDF)

router
.route("/so-get-banks-with-saved-accts")
.get(protect, spaceOwnerGetBanksAndSavedAccount)

router
.route("/so-verify-account-number")
.post(protect, spaceOwnerVerifyAccountNumber)

router
.route("/so-save-new-bank-details")
.post(protect, spaceOwnerSaveNewAccountDetails)

router
.route("/so-save-new-bank-details")
.post(protect, spaceOwnerSaveNewAccountDetails)

router
.route("/so-initiate-withdrawal")
.post(protect, initiateWithdrawal)

router
.route("/su-get-wallet")
.get(protect, spaceUserGetWallet)

router
.route("/su-get-wallet-payments")
.get(protect, getTransactionsForSpaceUsersWallet)

router
.route("/su-initialise-wallet-funding")
.post(protect, spaceUserInitialiseFundWallet)

router
.route("/su-verify-wallet-funding")
.post(protect, spaceUserVerifyWalletFunding)

export default router

