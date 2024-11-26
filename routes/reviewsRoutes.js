import express from 'express';
import { addNewReview, likeOrDislikeReview } from '../controllers/reviewsCtrlr.js';
import upload from '../uploadUtils/multer.js';
import { protect, spaceUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router
  .route("/su-add-new-review/:listingId")
  .post(protect, spaceUser, upload.array('reviewImages', 10), addNewReview);

router
  .route("/like-or-dislike-review/:listingId")
  .post(protect, likeOrDislikeReview);

export default router;