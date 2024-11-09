import express from "express";
import { protect, admin, superAdmin } from "../../middleware/authMiddleware.js";
import { 
    adminChangeUserRole,
    deleteUserAccount,
    editProfileInfo,
    editUserAccountStatus,
    getAllUsers,
    getUserData
 } from "../../controllers/adminCtrls/usersAdminC.js";

const router = express.Router()

router
.route("/all")
.get(protect, getAllUsers) 

router
.route("/:id")
.get(protect, admin, getUserData)

router
.route("/edit-account-status/:id")
.put(protect, admin, editUserAccountStatus)

router
.route("/edit-user-profile/:id")
.put(protect, admin, editProfileInfo)

router
.route("/delete-user-account/:id")
.delete(protect, admin, deleteUserAccount)

router
.route("/change-user-role")
.patch(protect, admin, superAdmin, adminChangeUserRole)

export default router

 