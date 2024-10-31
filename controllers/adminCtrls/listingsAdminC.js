import opencage from 'opencage-api-client';

import asyncHandler from "../../middleware/asyncHandler.js"
import Listing from "../../models/listingModel.js"
import cloudinaryConfig from '../../uploadUtils/cloudinaryConfig.js';
import { validateListingRequiredFields } from '../../utils/validateListings.js';
import sendEmail from '../../utils/sendMail.js';
import { sendListingApprovedEmail, sendListingRejectedEmail } from '../../utils/authUtils.js';
import DraftListing from '../../models/draftListingModel.js';
import User from '../../models/userModel.js';
import { formatSaveForLaterListingData } from '../../utils/formatListingData.js';

const getCoordinates = async (address) => {
    try {
      const response = await opencage.geocode({ q: address, key: process.env.OPENCAGE_API_KEY });
      if (response.results.length > 0) {
        const { lat, lng } = response.results[0].geometry;
        return { latitude: lat, longitude: lng };
      } else {
        throw new Error('No results found');
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error.message);
      throw error;
    }
  };
  
  // Generate a unique listing ID
  function generateListingId() {
    const randomDigits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
    return `OS${randomDigits}`;
  }
  
  // UPLOAD IMAGES
  const uploadListingImagesToCloudinary = async (items) => {
    return Promise.all(items.map(async (item) => {
      // Check if the image is already in the correct format (i.e., already has secure_url)
      if (typeof item === 'object' && item.secure_url && item.secure_url.startsWith('http')) {
        // The image is already uploaded, so return it as is
        return { secure_url: item.secure_url, public_id: item.public_id || null };
      } 
      
      // Check if it's a string that starts with 'http' (i.e., a URL)
      if (typeof item === 'string' && item.startsWith('http')) {
        // The image is a URL, so return it as is without uploading
        return { secure_url: item, public_id: null };
      } 
      
      // Otherwise, upload the file to Cloudinary
      const result = await cloudinaryConfig.uploader.upload(item.path, {
        folder: 'ourSpace/listing-images',
      });
      return {
        secure_url: result.secure_url,
        public_id: result.public_id
      };
    }));
  };
  
  
  const deleteImagesFromCloudinary = async (publicIds) => {
    return Promise.all(publicIds.map(async (publicId) => {
      if (publicId) {
        try {
          const result = await cloudinaryConfig.uploader.destroy(publicId);
          console.log(`Image with public_id ${publicId} deleted:`, result);
          return result;
        } catch (error) {
          console.error(`Error deleting image with public_id ${publicId}:`, error);
          throw error;
        }
      }
    }));
  };
  
const allowedPropertyTypes = ["house", "apartment", "resort", "guest-house", "office-space", 'bungalow', 'villa', 'loft'];

export const getAllListings = asyncHandler(async (req, res) => {
    console.log("Getting all listings...".yellow);

    const { listingStatus } = req.query;
    let filter = {};

    if (listingStatus) {
        const validStatuses = ["approved", "rejected", "pending", "active", "inactive", "draft", "archived", "blocked"];
        if (validStatuses.includes(listingStatus)) {
            filter.listingStatus = listingStatus;
            console.log(`Filtering listings by listingStatus: ${listingStatus}`.cyan);
        } else {
            console.log(`Invalid listingStatus provided: ${listingStatus}`.red);
            return res.status(400).json({
                success: false,
                message: "Invalid status provided. Must be one of: 'approved', 'rejected', 'pending', 'active', 'inactive', 'draft', 'archived', 'blocked'."
            });
        }
    }

    try {
        const listings = await Listing.find(filter)
            .populate({
                path: 'user', // Assuming 'user' is the field name in the Listing model referencing the User model
                select: 'firstName' // Only select the firstName field from the User model
            });

        console.log("All listings successfully retrieved".america);
        res.status(200).json({
            success: true,
            message: "All listings successfully retrieved",
            total: listings.length,
            data: listings
        });

    } catch (err) {
        console.log(`Error retrieving listings: ${err.message}`.red);
        res.status(400).json({
            success: false,
            message: `Error getting listings: ${err.message || err}`,
        });
    }
});

export const getListingById = asyncHandler(async (req, res) => {
    console.log("Getting a single listing by ID...".yellow);

    const { id } = req.params; // Extract the listing ID from the request parameters

    try {
        const listing = await Listing.findById(id)
            .populate({
                path: 'user', // Assuming 'user' is the field name in the Listing model referencing the User model
                select: 'firstName' // Only select the firstName field from the User model
            });

        // Check if the listing exists
        if (!listing) {
            console.log(`Listing not found with ID: ${id}`.red);
            return res.status(404).json({
                success: false,
                message: `Listing not found with ID: ${id}`
            });
        }

        console.log(`Listing successfully retrieved with ID: ${id}`.green);
        res.status(200).json({
            success: true,
            message: "Listing successfully retrieved",
            data: listing
        });

    } catch (err) {
        console.log(`Error retrieving listing: ${err.message}`.red);
        res.status(400).json({
            success: false,
            message: `Error getting listing: ${err.message || err}`,
        });
    }
});

export const updateListingStatus = asyncHandler(async (req, res) => {
    console.log("Updating listing status".yellow);

    try {
        const { listingId, newListingStatus } = req.query;

        // Validate the new listing status
        if (!newListingStatus || !["approved", "rejected", 'active', 'inactive', 'pending', 'draft', 'archived', 'blocked'].includes(newListingStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid listing status'
            });
        }

        const listing = await Listing.findById(listingId).populate('user');

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }

        // Perform validation for required fields when approving the listing
        if (newListingStatus === "approved") {
            const validationErrors = validateListingRequiredFields(listing);

            const to = listing.user.email;
            const fullName = listing.user.firstName;
            const listingName = listing.propertyName
            const rejectionDate = new Date()
            const approvalDate = new Date()

            if (validationErrors.length > 0) {
                const formattedErrors = validationErrors.join('<br>');

                // Send mail to notify the listing owner
                const to = listing.user.email;
                const fullName = listing.user.firstName;
                const listingName = listing.propertyName
                const rejectionReason = formattedErrors
                

                await sendListingRejectedEmail(to, fullName, listingName, rejectionDate, rejectionReason)

                console.log("Listing cannot be approved. An email containing the missing details has already also been sent to the property owner".red)
                return res.status(400).json({
                    success: false,
                    message: 'Listing cannot be approved. An email containing the missing details has already also been sent to the property owner. The following fields are missing or invalid:',
                    data: validationErrors
                });
            }

            // If no validation errors, update the status to approved and listed
            console.log("Sending email to user for successful approval".blue)
            await sendListingApprovedEmail(to, fullName, listingName, approvalDate)

            listing.listingStatus = newListingStatus;
            listing.status = "listed";
        } else if (newListingStatus === "active") {
            // If marking as active, update the status
            listing.listingStatus = newListingStatus;
            listing.status = "listed";
        } else {
            // For other statuses, mark the listing as unlisted
            listing.listingStatus = newListingStatus;
            listing.status = "unlisted";
        }

        // Save the updated listing
        await listing.save();

        console.log("Listing status successful updated".magenta)
        res.status(200).json({
            success: true,
            message: 'Listing status updated successfully',
            data: listing
        });
    } catch (error) {
        console.error(`Error updating listing status: ${error.message}`.red);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
            error
        });
    }
});


export const tempUpdateListingStatus = asyncHandler(async (req, res) => {
    console.log("Updating listing status".yellow);

    try {
        const listings = await Listing.find()

        // Loop through each listing and update the status
        for (let listing of listings) { // Use let to allow reassignment
            if (listing.listingStatus === "approved") {
                listing.status = "listed";
            } else {
                listing.status = "unlisted";
            }
            await listing.save(); // Save the updated listing to the database
        }     
        console.log("Status for each listing successfully updated".green);
        return res.status(201).json({
            success: true,
            message: "Status update for each listing successful"
        });

    } catch (error) {
        console.log("Error", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error: " + error.message
        });
    }
});

export const updateStatus = asyncHandler(async (req, res) => {
    console.log("Updating status".yellow);

    try {
        const listings = await Listing.find();

        if (!listings || listings.length === 0) {
            console.log("No listings found".red);
            return res.status(404).json({
                success: false,
                message: "No listings found"
            });
        }

        console.log(`Total of ${listings.length} listings found`.green);

        // Loop through each listing and update the status
        for (let listing of listings) { // Use let to allow reassignment
            if (listing.status === "approved") {
                listing.status = "listed";
            } else {
                listing.status = "unlisted";
            }
            await listing.save(); // Save the updated listing to the database
        }

        console.log("Status for each listing successfully updated".green);
        return res.status(201).json({
            success: true,
            message: "Status update for each listing successful"
        });

    } catch (error) {
        console.log("Error", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error: " + error.message
        });
    }
}); 

export const getAllSpaceOwners = asyncHandler(async(req, res) => {
    console.log("Admin getting all space owners".blue)

    if(!req.user.isAdmin) {
        console.log("User is not an admin".red)
        return res.status(401).json({
            success: false,
            message: "User is not authorised, only admins are allowed"
        })
    }

    try {
        const allSpaceOwners = await User.find({
            userType: "space-owner"
        })

        if(!allSpaceOwners) {
            console.log("No user found at the moment".red)
            return res.status(200).json({
                success: true,
                message: "No user found at the moment",
                data: allSpaceOwners
            })
        }

        console.log("Users found".green)

        const formattedUsers = allSpaceOwners.map((user) => ({
            id: user._id,
            email: user.email,
            displayImage: user.profilePic.secure_url,
            fullName: user.firstName + " " + user.lastName,
            userType: user.userType,
            verification: user.isKycVerified,
            rating: user.rating || 0,
            review: user.review || 0
        }))

        console.log(`Total of ${allSpaceOwners.length} users found`.rainbow)
        return res.status(200).json({
            success: true,
            message: `Total of ${allSpaceOwners.length} users found`,
            data: formattedUsers
        })
    } catch (error) {
        console.log("Error retrieving users", error)
        return res.status(500).json({
            success: false,
            message: "Error retrieving users"
        })
    }
})

export const adminSaveListingForLater = asyncHandler(async (req, res) => {
    console.log("Amin Saving new listing to draft".yellow);
    const userId = req.user._id.toString();

    const { selectedUserEmail } = req.body

    console.log("Selected user email: ", selectedUserEmail)

    let selectedUser;
    let selectedUserId

    if(selectedUserEmail) {

        selectedUser = await User.findOne({email: selectedUserEmail})

        selectedUserId = selectedUser._id

        if(!selectedUser) {
            console.log("The selected user cannot be found".red)
            return res.status(404).json({
                success: false,
                message: "The selected user cannot be found in the list of users"
            })
        }
    }

    console.log("SelectedUserId: ",selectedUserId)
  
    const listingId = req.body.listingId;
    let existingListing = null;
  
    // Check if the listing exists
    if (listingId) {
      existingListing = await DraftListing.findById(listingId);
      if (!existingListing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }
    }
  
    let removedImages = req.body.removedImages;
  
    // Handle removed images
    if (removedImages) {
      console.log("Removing images", removedImages);
      if (typeof removedImages === 'string') {
        try {
          removedImages = JSON.parse(removedImages);
        } catch (error) {
          console.error('Error parsing removedImages:', error);
          removedImages = removedImages.split(',').map((image) => image.trim());
        }
      }
  
      if (!Array.isArray(removedImages)) {
        console.log("Removed images should be an array".red);
        return res.status(400).json({
          success: false,
          message: "Removed images should be an array",
        });
      }
  
      try {
        console.log("Deleting images from Cloudinary".red);
        await deleteImagesFromCloudinary(removedImages);
      } catch (error) {
        console.error("Error during image deletion:", error);
        return res.status(500).json({
          success: false,
          message: `Error deleting images: ${error.message}`,
        });
      }
    }
  
    // Format the listing data using the same logic as createListing
    const formattedData = formatSaveForLaterListingData(req);
  
    let existingAvailableAmenities = existingListing ? existingListing.availableAmenities : {};
    const newAvailableAmenities = {
      ...existingAvailableAmenities,
      propertyAmenities: formattedData.availableAmenities.propertyAmenities || existingAvailableAmenities.propertyAmenities,
      roomFeatures: formattedData.availableAmenities.roomFeatures || existingAvailableAmenities.roomFeatures,
      outdoorActivities: formattedData.availableAmenities.outdoorActivities || existingAvailableAmenities.outdoorActivities
    };
  
    // Combine all amenities into the `allAmenities` field
    const allAmenitiesSet = new Set([
      ...(newAvailableAmenities.propertyAmenities || []),
      ...(newAvailableAmenities.roomFeatures || []),
      ...(newAvailableAmenities.outdoorActivities || [])
    ]);
  
    formattedData.availableAmenities = {
      ...newAvailableAmenities,
      allAmenities: Array.from(allAmenitiesSet)
    };
  
    let existingArrivalDepartureDetails = existingListing ? existingListing.arrivalDepartureDetails : {};
    const newArrivalDepartureDetails = {
      ...existingArrivalDepartureDetails,
      ...formattedData.arrivalDepartureDetails
    };
    formattedData.arrivalDepartureDetails = newArrivalDepartureDetails;
  
    // Define the image categories required
    const imageCategories = [
      'bedroomPictures',
      'livingRoomPictures',
      'bathroomToiletPictures',
      'kitchenPictures',
      'facilityPictures',
      'otherPictures',
    ];
  
    let updatedImages = {};
    try {
      console.log("Uploading new images and merging with existing images".blue);
  
      for (let category of imageCategories) {
        // Upload new images if they exist in the request
        const newImages = req.files?.[category]
          ? await uploadListingImagesToCloudinary(req.files[category])
          : null;
  
        // Retain existing images from the listing that are not in the removedImages list
        const existingImages = existingListing && existingListing[category]
          ? existingListing[category].filter(
              (image) => !removedImages || !removedImages.includes(image.public_id)
            )
          : [];
  
        // If new images are provided, merge them with the existing ones; otherwise, keep only existing images
        updatedImages[category] = newImages ? [...existingImages, ...newImages] : existingImages;
      }
    } catch (error) {
      console.error("Error during image upload:", error);
      return res.status(500).json({
        success: false,
        message: `Error uploading new images: ${error.message}`,
      });
    }
  
    // Merge formatted data with the updated images and existing listing data if it exists
    let updateData = existingListing
      ? {
          ...existingListing.toObject(), // Spread the existing listing data to keep all current fields
          ...formattedData,              // Overwrite with new data from the request body (e.g., fields being updated)
          ...updatedImages,              // Include the updated images data
        }
      : {
          ...formattedData,
          ...updatedImages,
        };
  
    let latitude, longitude;
  
    // Fetch coordinates based on the address if provided
    if (
      formattedData.propertyLocation &&
      formattedData.propertyLocation.state &&
      formattedData.propertyLocation.city &&
      formattedData.propertyLocation.address
    ) {
      try {
        const { address, city, state } = formattedData.propertyLocation;
        const fullAddress = `${address}, ${city}, ${state}`;
        const coordinates = await getCoordinates(fullAddress);
  
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
  
        console.log(`Latitude: ${latitude} and Longitude: ${longitude} obtained`.cyan);
      } catch (error) {
        console.log(`Error getting coordinates: ${error}`.red);
        return res.status(500).json({
          success: false,
          message: `Error getting coordinates: ${error.message}`,
        });
      }
    }
  
    // Add location coordinates if available
    if (latitude && longitude) {
      updateData.propertyLocation = {
        ...updateData.propertyLocation,
        latitude,
        longitude,
      };
    }
  
    // Create a new listing or update the existing one
    try {
      if (existingListing) {
        console.log("Updating existing draft listing".green);
        existingListing = await DraftListing.findByIdAndUpdate(listingId, updateData,
        { new: true}
      );
      } else {
        console.log("Creating new draft listing".green);
        existingListing = await DraftListing.create({
          ...updateData,
          user: selectedUserId,
          propertyId: generateListingId(),
        });
      }
  
      // const finalUpdatedListing = await DraftListing.findById(listingId)
  
      console.log("Listing saved successfully as draft".magenta);
      res.status(200).json({
        success: true,
        message: "Listing saved successfully as draft",
        data: existingListing,
      });
    } catch (error) {
      console.error("Error saving listing:", error);
      return res.status(500).json({
        success: false,
        message: `Server error: ${error.message}`,
        error,
      });
    }
  });