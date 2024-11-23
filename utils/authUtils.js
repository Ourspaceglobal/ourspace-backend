import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import otpGenerator from "otp-generator"; 
import OTP from '../models/otpModel.js';
import { isAfter } from 'date-fns';
import { OTPExpiredError } from './otpErrors.js';
import { passwordResetEmailTemplate } from '../email_templates/passwordResetEmailTemplate.js';
import { otpVerificationCodeTemplate } from '../email_templates/otpVerificationCodeTemplate.js';
import { welcomeEmail } from '../email_templates/welcomeMail.js';
import { successfulPaymentMail } from '../email_templates/successfulPaymentMail.js';
import { listingRejectedEmail } from '../email_templates/listingRejectionEmail.js';
import { ListingApprovedMail } from '../email_templates/listingApprovedEmail.js';
import { successfulBookingMailToSpaceOwner, successfulBookingMailToSuperAdmin, successfulPriceUpdateEmail } from '../email_templates/successfulBookingMailToSpaceOwner.js';
import { formatAmount } from './helperFunction.js';

const hashFunction = async (data) => {
  const saltRounds = 10; // Salt rounds for bcrypt
  return bcrypt.hash(data, saltRounds);
};

export const generateOTP = async () => {
  const otp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false })

  const hashedOTP = await hashFunction(otp);

  return { otp, hashedOTP };
};

export const saveOTPToDatabase = async (userId,  otp, hashedOTP) => {
  try {
    const newOTP = new OTP({
      user: userId,
      otp: hashedOTP,
      createdAt: Date.now(),
      expiresAt: Date.now() + 400000, // Expires in 3 minutes (600,000 milliseconds)
    });

    await newOTP.save();
    return otp; // Return the plain OTP for sending via email or other methods
  } catch (error) {
    console.error('Error saving OTP to database:', error);
    throw new Error('Failed to save OTP');
  }
};

export const sendOTPByEmail = async (email,otp) => {
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const otpExpiresAt = "3 minutes"
    const htmlContent = otpVerificationCodeTemplate(email, otp, otpExpiresAt);

    const mailOptions = {
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: 'Login OTP Confirmation Code',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending otp email:', error);
    throw new Error('Failed to send OTP email');
  }
};

export const sendWelcomeEmail = async (email, firstName) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = welcomeEmail(firstName);

    const mailOptions = {
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: 'Welcome to ourspace',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
}

export const sendListingApprovedEmail= async (email, fullName, listingName, approvalDate) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await ListingApprovedMail(fullName, listingName, approvalDate);

    const mailOptions = {
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: `new listing successfully approved`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
}

export const sendListingRejectedEmail= async (email, fullName, listingName, rejectionDate, rejectionReason) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await listingRejectedEmail(fullName, listingName, rejectionDate, rejectionReason);

    const mailOptions = {
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: `New listing rejected`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending listing rejection email:', error);
    throw new Error('Failed to send listing rejection email');
  }
}


export const sendSuccessfulPaymentMail = async (email, fullName, apartmentName, totalNight, amountPaid) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await successfulPaymentMail(fullName, apartmentName, totalNight, amountPaid);

    const mailOptions = { 
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: `Payment successful for new bookings: #${amountPaid}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending successful bookings payment email:', error);
    throw new Error('Failed to send successful bookings payment email');
  }
}

export const sendSuccessfulBookingMailToSpaceOwner = async (email, spaceUserName, apartmentName, totalNight, daysBooked, totalPaid) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await successfulBookingMailToSpaceOwner(spaceUserName, apartmentName, totalNight, daysBooked, totalPaid);

    const mailOptions = {
      from: {
        name: "Ourspace",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: `New successful booking: #${totalPaid}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending successful booking email to space owner:', error);
    throw new Error('Error sending successful booking email to space owner');
  }
}

//                      Send successful booking mail to all super admins
export const sendSuccessfulBookingMailToAllSuperAdmin = async (spaceUserName, apartmentName, totalNight, daysBooked, totalPaid, spaceUserEmail, spaceOwnerName, spaceOwnerEmail, superAdminEmail)=> {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await successfulBookingMailToSuperAdmin(spaceUserName, apartmentName, totalNight, daysBooked, totalPaid, spaceUserEmail, spaceOwnerName, spaceOwnerEmail, superAdminEmail);

    const mailOptions = {
      from: {
        name: `OS - New Booking: ${formatAmount(totalPaid)}`,
        address: process.env.EMAIL_USER,
      },
      to: superAdminEmail,
      subject: `New successful booking: #${formatAmount(totalPaid)}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending successful booking email to space owner:', error);
    throw new Error('Error sending successful booking email to space owner');
  }
}

export const sendPropertyPriceUpdateToUsers = async (spaceUserEmail, apartmentName, oldChargePerNight, newChargePerNight)=> {

  if (oldChargePerNight == null || newChargePerNight == null) {
    throw new Error("Invalid charge per night values");
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = await successfulPriceUpdateEmail(apartmentName, oldChargePerNight, newChargePerNight);

    const mailOptions = {
      from: {
        name: `OS - Booking Price Update`,
        address: process.env.EMAIL_USER,git add .
      },
      to: spaceUserEmail,
      subject: `Change In Booking Price: #${formatAmount(newChargePerNight)}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${spaceUserEmail}`);
  } catch (error) {
    console.error('Error sending booking price update to space user:', error);
    throw new Error('Error sending booking price update to space user');
  }
}

export const verifyOTP = async (userId, inputOTP) => {
    console.log("Searching for otp".grey)
  try {

    console.log("Finding otp from database...".green);
    const existingOtp = await OTP.findOne({user: userId})
    const hashedOtp = existingOtp.otp
        
        if (hashedOtp) {
            const isMatch = await bcrypt.compare(inputOTP, hashedOtp);
            console.log(`Input OTP: ${inputOTP}, hashed OTP: ${hashedOtp}`.yellow);
            console.log(`isMatch: ${isMatch}`)

            if (isMatch === false) {
                console.log("Invalid OTP entered!!!".red)
                return false;
            } else if(isMatch === true) {
                const updatedUser = await User.findByIdAndUpdate(userId, { isEmailVerified: true });
                updatedUser.save()
                console.log("Valid OTP inserted and isEmailVerified set to true".magenta)
                
                const currentTime = new Date();
                if (isAfter(currentTime, existingOtp.expiresAt)) {
                    console.log("OTP expired".red);
                    return false;
                } else {
                    return true;
                }
            }
        }else {
            return false;
        }
  } catch (error) {
    console.log(error.message.blue);
  }
};


