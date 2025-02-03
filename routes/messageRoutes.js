import express from "express";

import {admin, protect, spaceOwner, spaceUser, superAdmin} from "../middleware/authMiddleware.js"
import {chatWithSpaceOwner, getMessagesForAListing, postmanSendMessage, spaceOwnerGetAllChats, spaceUserGetAllChats } from "../controllers/messageCtrlr.js";
import upload from "../uploadUtils/multer.js";


const router = express.Router();

router
.route("/send-message")
.post(protect, upload.single('messageMedia'),postmanSendMessage)

// 
router
.route("/so-get-all-chats")
.get(protect, spaceOwner, spaceOwnerGetAllChats)

//
router
.route("/su-get-all-chats")
.get(protect, spaceUser, spaceUserGetAllChats)

//
router
.route("/get-messages-for-a-listing")
.post(protect, getMessagesForAListing)

// //
// router
// .route("/postman-get-messages-for-a-listing")
// .post(protect, getMessagesForAListingPostman)

//
router
.route("/su-chat-so")
.post(protect, spaceUser, chatWithSpaceOwner)


router
.route("/so-chat-su")
.post(protect, spaceOwner, chatWithSpaceOwner)

export default router;