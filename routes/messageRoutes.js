import express from "express";

import {admin, protect} from "../middleware/authMiddleware.js"
import {chatWithSpaceOwner, getMessagesForAListing, postmanSendMessage, sendMessage, spaceOwnerGetAllChats, spaceUserGetAllChats } from "../controllers/messageCtrlr.js";
import upload from "../uploadUtils/multer.js";


const router = express.Router();

router.route("/send-message").post(protect, upload.single('messageMedia'),postmanSendMessage)
router.route("/chat-so-before-booking").post(protect, chatWithSpaceOwner)
router.route("/so-get-all-chats").get(protect, spaceOwnerGetAllChats)
router.route("/su-get-all-chats").get(protect, spaceUserGetAllChats)
router.route("/get-messages-for-a-listing").post(protect, getMessagesForAListing)
router.route("/su-chat-so").post(protect, chatWithSpaceOwner)
router.route("/so-chat-su").post(protect, chatWithSpaceOwner)

export default router;