import express from "express";
import { protect, spaceOwner, spaceUser } from "../middleware/authMiddleware.js";
import { downloadBookingPDF, getTransactionsForSpaceUsersWallet, spaceOwnerInitiateWithdrawal, soGetSingleBookingFromWalletDashboard, spaceOwnerGetBanksAndSavedAccount, spaceOwnerGetWallet, spaceOwnerSaveNewAccountDetails, spaceOwnerVerifyAccountNumber, spaceUserGetSingleTransactionDetails, spaceUserGetWallet, spaceUserInitialiseFundWallet, spaceUserVerifyWalletFunding } from "../controllers/walletController.js";

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
.post(protect, spaceOwner, spaceOwnerInitiateWithdrawal)

router
.route("/su-get-wallet")
.get(protect, spaceUser, spaceUserGetWallet)

router
.route("/su-get-wallet-payments")
.get(protect, spaceUser, getTransactionsForSpaceUsersWallet)

router
.route("/su-get-single-wallet-transaction")
.get(protect, spaceUser, spaceUserGetSingleTransactionDetails)

router
.route("/su-initialise-wallet-funding")
.post(protect, spaceUser, spaceUserInitialiseFundWallet)

router
.route("/su-verify-wallet-funding")
.post(protect, spaceUser, spaceUserVerifyWalletFunding)

export default router

