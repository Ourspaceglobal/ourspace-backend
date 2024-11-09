import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import User from '../models/userModel.js';
import util from "util";

// User must be authenticated
const protect = asyncHandler(async (req, res, next) => {
  const testToken = req.headers.authorization;
  let token;

  if (testToken && testToken.startsWith('Bearer')) {
    token = testToken.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, login required"
    });
  }

  try {
    const decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User does not exist"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Invalid or expired token, please log in again")
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token, please login again"
    });
  }
});


// User must be an admin
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied, admin only'
    });
  }
};

const superAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin && req.user.role === "super-user") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied, yes you are an admin, but access for this fundtion is only available for super admins'
    });
  }
};

const localVariables = (req, res, next) => {
  req.app.locals = {
      OTP: null,
      resetSession: false,
  };
  next();
};

export { protect, admin, superAdmin, localVariables };