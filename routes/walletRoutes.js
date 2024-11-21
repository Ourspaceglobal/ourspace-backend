import express from "express";
import { protect, spaceOwner } from "../middleware/authMiddleware.js";
import { downloadBookingPDF, getTransactionsForSpaceUsersWallet, initiateWithdrawal, soGetSingleBookingFromWalletDashboard, spaceOwnerGetBanksAndSavedAccount, spaceOwnerGetWallet, spaceOwnerSaveNewAccountDetails, spaceOwnerVerifyAccountNumber, spaceUserGetSingleTransactionDetails, spaceUserGetWallet, spaceUserInitialiseFundWallet, spaceUserVerifyWalletFunding } from "../controllers/walletController.js";

const router = express.Router()


router
.route("/so-get-wallet-dashboard")
.get(protect,spaceOwner, spaceOwnerGetWallet)

router
.route("/so-view-payment-invoice")
.get(protect, spaceOwner, soGetSingleBookingFromWalletDashboard)

router
.route("/so-download-invoice-as-pdf")
.get(protect, spaceOwner, downloadBookingPDF)

router
.route("/so-get-banks-with-saved-accts")
.get(protect, spaceOwner, spaceOwnerGetBanksAndSavedAccount)

router
.route("/so-verify-account-number")
.post(protect, spaceOwner, spaceOwnerVerifyAccountNumber)

router
.route("/so-save-new-bank-details")
.post(protect, spaceOwner, spaceOwnerSaveNewAccountDetails)

router
.route("/so-save-new-bank-details")
.post(protect, spaceOwner, spaceOwnerSaveNewAccountDetails)

router
.route("/so-initiate-withdrawal")
.post(protect, spaceOwner, initiateWithdrawal)

router
.route("/su-get-wallet")
.get(protect, spaceUserGetWallet)

router
.route("/su-get-wallet-payments")
.get(protect, getTransactionsForSpaceUsersWallet)

router
.route("/su-get-single-wallet-transaction")
.get(protect, spaceUserGetSingleTransactionDetails)

router
.route("/su-initialise-wallet-funding")
.post(protect, spaceUserInitialiseFundWallet)

router
.route("/su-verify-wallet-funding")
.post(protect, spaceUserVerifyWalletFunding)

export default router

