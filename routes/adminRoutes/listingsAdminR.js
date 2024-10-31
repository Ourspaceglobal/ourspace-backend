import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import { adminSaveListingForLater, getAllListings, getAllSpaceOwners, getListingById, tempUpdateListingStatus, updateListingStatus, updateStatus } from "../../controllers/adminCtrls/listingsAdminC.js";
import upload from "../../uploadUtils/multer.js";

const router = express.Router()

router
.route("/all")
.get(protect, admin, getAllListings) 

router
  .route('/save-listing-to-draft')
  .patch(protect, upload.fields([
    { name: 'bedroomPictures', maxCount: 10 },
    { name: 'livingRoomPictures', maxCount: 10 },
    { name: 'bathroomToiletPictures', maxCount: 10 },
    { name: 'kitchenPictures', maxCount: 10 },
    { name: 'facilityPictures', maxCount: 10 },
    { name: 'otherPictures', maxCount: 10 }
  ]), adminSaveListingForLater);

router
.route("/update-status")
.put(protect, admin, updateListingStatus) 

router
.route("/status-update")
.put(protect, admin, updateStatus) 

router
.route("/get-all-space-owners")
.get(protect, admin, getAllSpaceOwners)

router
.route("/get-single-listing/:id")
.get(protect, admin, getListingById)  

export default router
