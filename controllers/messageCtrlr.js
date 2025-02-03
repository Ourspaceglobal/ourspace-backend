import asyncHandler from "../middleware/asyncHandler.js";
import Booking from "../models/bookingModel.js";
import Listing from "../models/listingModel.js";
import Message from "../models/messageModel.js";
import User from "../models/userModel.js";
import cloudinaryConfig from "../uploadUtils/cloudinaryConfig.js";
import colors from "colors"

const uploadMessageMediaToCloudinary = async (item, isAudio = false) => {
  try {
    // Check if the item is a URL (already uploaded media)
    if (typeof item === 'string' && item.startsWith('http')) {
      return { secure_url: item, public_id: null };
    } else {
      let uploadItem = item;

      // If it's an audio file in base64 format, strip the data URL prefix
      if (isAudio && typeof item === 'string' && item.startsWith('data:audio')) {
        uploadItem = item.split(',')[1]; // Remove the 'data:audio/mp3;base64,' prefix
        uploadItem = `data:audio/mp3;base64,${uploadItem}`; // Rebuild the valid base64 string
      }

      // Set Cloudinary options with correct resource type
      const uploadOptions = {
        folder: isAudio ? 'ourSpace/message-voice-notes' : 'ourSpace/message-media',
        resource_type: isAudio ? 'video' : 'image' // Explicitly set resource type for audio
      };

      const result = await cloudinaryConfig.uploader.upload(uploadItem, uploadOptions);

      return {
        secure_url: result.secure_url,
        public_id: result.public_id
      };
    }
  } catch (error) {
    console.error("Error during Cloudinary upload:", error); // Log the full error details
    throw new Error("Cloudinary upload failed: " + error.message);
  }
};

const getLatestMessagesForChats = async (listingIds, currentUserId) => {
  return await Message.aggregate([
    { $match: { listing: { $in: listingIds } } },
    { $sort: { createdAt: -1 } }, 
    {
      $group: {
        _id: {
          listing: "$listing",
          otherUserId: { $cond: [{ $eq: ["$sender", currentUserId] }, "$receiver", "$sender"] }
        },
        lastMessageContent: { $first: "$content" },
        lastMessageTimestamp: { $first: "$createdAt" },
        messageMedia: { $first: "$messageMedia" }, // Include messageMedia
        voiceNote: { $first: "$voiceNote" } // Include voiceNote
      }
    },
    {
      $lookup: {
        from: "users", 
        localField: "_id.otherUserId",
        foreignField: "_id",
        as: "propertyUser"
      }
    },
    { $unwind: "$propertyUser" },
    {
      $lookup: {
        from: "listings",
        localField: "_id.listing",
        foreignField: "_id",
        as: "listingDetails"
      }
    },
    { $unwind: "$listingDetails" },
    {
      $project: {
        listing: "$_id.listing",
        lastMessageContent: 1,
        lastMessageTimestamp: 1,
        messageMedia: 1, 
        voiceNote: 1,   
        propertyUser: {
          id: "$propertyUser._id",
          name: { $concat: ["$propertyUser.firstName", " ", "$propertyUser.lastName"] },
          profilePic: "$propertyUser.profilePic"
        },
        listing: {
          id: "$listingDetails._id",
          propertyName: "$listingDetails.propertyName",
          bedroomPictures: "$listingDetails.bedroomPictures"
        }
      }
    }
  ]);
};

//                                  get all chats for space owners
const spaceOwnerGetAllChats = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all listings owned by the current space owner
    const listings = await Listing.find({ user: currentUserId }).select('_id');
    const listingIds = listings.map(listing => listing._id);

    // Get the latest messages for the listings
    const latestMessages = await getLatestMessagesForChats(listingIds, currentUserId);

    // Initialize an array to hold the final response data
    // Initialize an array to hold the final response data
    const result = await Promise.all(
      latestMessages.map(async (message) => {
        // Check if lastMessageContent is empty and if there's media or voice notes
        const hasMedia = (message.messageMedia && message.messageMedia.length > 0) || (message.voiceNote && message.voiceNote.length > 0);
        const lastMessageContent = message.lastMessageContent || (hasMedia ? "new media file received" : '');

        // Calculate the number of unread messages for the chat
        const unreadMessageCount = await Message.countDocuments({
          listing: message.listing.id,
          sender: message.propertyUser.id,
          receiver: currentUserId,
          isRead: false,
        });

        return {
          propertyOwner: {
            id: currentUserId,
            name: req.user.firstName + " " + req.user.lastName,
            profilePic: req.user.profilePic,
          },
          propertyUser: {
            id: message.propertyUser.id,
            name: message.propertyUser.name,
            profilePic: message.propertyUser.profilePic,
          },
          property: {
            id: message.listing.id,
            name: message.listing.propertyName,
            image: message.listing.bedroomPictures ? message.listing.bedroomPictures[0] : '', // First image
          },
          lastMessageContent: lastMessageContent,
          lastMessageTimestamp: message.lastMessageTimestamp || Date.now(),
          unreadMessageCount
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "All messages retrieved successfully",
      total: result.length,
      data: result
    });
  } catch (error) {
    console.error("Error getting all chats for space owner", error);
    return res.status(500).json({
      success: false,
      message: "Error getting all chats for space owner"
    });
  }
};

//                                  get all chats for space users
const spaceUserGetAllChats = async (req, res) => {
  console.log("Space user get all chats".yellow);

  try {
    const currentUserId = req.user._id;
    const userType = req.user.userType;

    if (userType !== "space-user") {
      console.log("Only space users are allowed".red);
      return res.status(403).json({
        success: false,
        message: "Only space users are allowed",
      });
    }

    // Find all messages where the user is either the sender or the receiver
    const latestMessages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: currentUserId }, { receiver: currentUserId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            listing: "$listing",
            otherUserId: {
              $cond: [{ $eq: ["$sender", currentUserId] }, "$receiver", "$sender"],
            },
          },
          lastMessageContent: { $first: "$content" },
          lastMessageTimestamp: { $first: "$createdAt" },
          messageMedia: { $first: "$messageMedia" }, // Include messageMedia
          voiceNote: { $first: "$voiceNote" }, // Include voiceNote
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.otherUserId",
          foreignField: "_id",
          as: "propertyUser",
        },
      },
      { $unwind: "$propertyUser" },
      {
        $lookup: {
          from: "listings",
          localField: "_id.listing",
          foreignField: "_id",
          as: "listingDetails",
        },
      },
      { $unwind: "$listingDetails" },
      {
        $lookup: {
          from: "users",
          localField: "listingDetails.user",
          foreignField: "_id",
          as: "propertyOwner",
        },
      },
      { $unwind: "$propertyOwner" },
      // Count unread messages for the current chat
      {
        $lookup: {
          from: "messages", // Message collection
          let: { listingId: "$_id.listing", otherUserId: "$_id.otherUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$listing", "$$listingId"] },
                    { $eq: ["$sender", "$$otherUserId"] },
                    { $eq: ["$receiver", currentUserId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
              },
            },
          ],
          as: "unreadMessages",
        },
      },
      {
        $addFields: {
          unreadMessageCount: { $size: "$unreadMessages" }, // Calculate the count
        },
      },
      {
        $project: {
          propertyOwner: {
            id: "$propertyOwner._id",
            name: {
              $concat: ["$propertyOwner.firstName", " ", "$propertyOwner.lastName"],
            },
            profilePic: { $ifNull: ["$propertyOwner.profilePic", ""] },
          },
          propertyUser: {
            id: currentUserId,
            name: req.user.firstName + " " + req.user.lastName,
            profilePic: req.user.profilePic,
          },
          property: {
            id: "$listingDetails._id",
            name: "$listingDetails.propertyName",
            image: { $arrayElemAt: ["$listingDetails.bedroomPictures", 0] }, // First image
          },
          lastMessageContent: {
            $cond: [
              {
                $and: [
                  { $eq: ["$lastMessageContent", ""] },
                  {
                    $or: [
                      { $ne: ["$messageMedia", []] },
                      { $ne: ["$voiceNote", []] },
                    ],
                  },
                ],
              },
              "New media file received",
              "$lastMessageContent",
            ],
          },
          lastMessageTimestamp: "$lastMessageTimestamp",
          unreadMessageCount: 1, // Add the unread message count
        },
      },
    ]);

    console.log("All messages for space user retrieved".green);

    return res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      total: latestMessages.length,
      data: latestMessages,
    });
  } catch (error) {
    console.error("Error getting all chats for space users", error);
    return res.status(500).json({
      success: false,
      message: "Error getting all chats for space users",
      error,
    });
  }
};


const getMessagesForAListing = asyncHandler(async (data, res) => {

  console.log(colors.yellow("Getting all messages for a chat"))

  try {
    const {currentUserId, listingId, otherUserId } = data;

    console.log("Current user id: ", currentUserId)
    console.log("other user Id: ", otherUserId)
    console.log("Listing Id: ", listingId)

    // Find all messages between the current user and the other user for a specific listing
    const messages = await Message.find({
      $and: [
        { listing: listingId }, // Messages related to the listing
        {
          $or: [
            { sender: currentUserId, receiver: otherUserId },
            { sender: otherUserId, receiver: currentUserId },
          ],
        },
      ],
    })
      .sort({ timestamp: 1 })
      .populate('sender', 'profilePic')
      .exec();

      console.log("Messages: ", messages)

    if (!messages || messages.length === 0) {
      console.log(colors.red("No messages available at the moment"))
      return {
        success: true,
        message: 'No messages found for this listing',
        data: [],
      };
    }

    for (let message of messages) {
      if (!message.isRead) {
        console.log("Updating message read count status".green)
        message.isRead = true;
        await message.save();
      }
    }    

    return {
      success: true,
      message: 'Messages retrieved successfully for the listing',
      total: messages.length,
      data: messages.map(message => ({
        senderId: message.sender._id,
        displayImage: message.sender.profilePic,
        content: message.content,
        timestamp: message.timestamp,
        messageMedia: message.messageMedia,
        voiceNote: message.voiceNote
      })),
    };
  } catch (error) {
    console.log("Something went wrong", error);
    return { success: false, message: "Something went wrong", error };
  }
});

//                                 send message
const sendMessage = asyncHandler(async (data) => {
  console.log("Sending a new message".cyan);

  try {
    const { senderId, listingId, content, receiverId, messageMedia, voiceNote } = data;

    // Fetching receiver and listing details
    const receiverUser = await User.findById(receiverId);
    const propertyListing = await Listing.findById(listingId);
    const sender = await User.findById(senderId)


    // Validate listing and receiver
    if (!propertyListing) {
      console.log("This listing isn't available again or has been deleted by the owner".bgRed);
      return {
        success: false,
        message: "This listing isn't available again or has been deleted by the owner",
      };
    }

    if (!receiverUser) {
      console.log("User does not exist or account has been suspended or deleted".bgRed);
      return {
        success: false,
        message: "User does not exist or account has been suspended or deleted",
      };
    }

    if (!sender) {
      console.log("User does not exist or account has been suspended or deleted".bgRed);
      return {
        success: false,
        message: "User does not exist or account has been suspended or deleted",
      };
    }

    let uploadedMedia = null;

    // Upload message media if it exists
    if (messageMedia) {
      console.log("Processing uploaded media file".cyan);
      uploadedMedia = await uploadMessageMediaToCloudinary(messageMedia);
      console.log("Media uploaded to Cloudinary".green);
    }

    let voiceNoteMedia = null;
    if (voiceNote) {
      console.log("Processing voice note file".cyan);
      try {
        voiceNoteMedia = await uploadMessageMediaToCloudinary(voiceNote, true); // Pass true for audio
        console.log("Voice note uploaded to Cloudinary".green);
      } catch (error) {
        console.error("Error uploading voice note:", error); // Log the error for voice note
        return { success: false, message: "Error uploading voice note" };
      }
    }

    const lastMessage = await Message.find({
      sender: senderId,
      receiver: receiverUser._id,
      listing: propertyListing._id
    }).sort({createdAt: -1})

    if (lastMessage && lastMessage[0]?.content === content) {
      console.log("Last message content is the same as the new message content");
    
      const currentDate = new Date();
      const timeDifference = (currentDate - lastMessage[0].createdAt) / 1000; // Time difference in seconds
    
      if (timeDifference <= 2) {
        console.log("Message sent within 2 seconds of the last message. Skipping duplicate save.");
        return {
          success: false,
          message: "Duplicate message detected. Message not sent again.",
        };
      }
    }

    // Create and save the message
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverUser._id,
      listing: propertyListing._id,
      content,
      messageMedia: uploadedMedia ? [uploadedMedia] : [],
      voiceNote: voiceNoteMedia ? [voiceNoteMedia] : [],
    });

    await newMessage.save();

    // Create response in the structure needed by the frontend
    const formattedResponse = {
      senderId: senderId,
      displayImage: sender.profilePic,
      content: newMessage.content,
      timestamp: newMessage.createdAt,
      messageMedia: newMessage.messageMedia || [],
      voiceNote: newMessage.voiceNote || []
    };

    return formattedResponse
  } catch (error) {
    console.error("Error sending message:", error);
    return {
      success: false,
      message: "Error sending message",
      error,
    };
  }
});

const postmanSendMessage = asyncHandler(async (req, res) => {
  console.log("Sending a new message".green);

  const data = req.body;

  try {
    const {listingId, content, receiverId} = data;

    // Fetching receiver and listing details
    const receiverUser = await User.findById(receiverId);
    const propertyListing = await Listing.findById(listingId);

    // Validate listing and receiver
    if (!propertyListing) {
      console.log("This listing isn't available again or has been deleted by the owner".bgRed);
      return res.status(404).json({
        success: false,
        message: "This listing isn't available again or has been deleted by the owner",
      });
    }

    if (!receiverUser) {
      console.log("User does not exist or account has been suspended or deleted".bgRed);
      return res.status(404).json({
        success: false,
        message: "User does not exist or account has been suspended or deleted",
      });
    }

    let uploadedMedia = null;

    // Upload message media if it exists
    if (req.file) {
      console.log("Processing uploaded media file".cyan);
      uploadedMedia = await uploadMessageMedia(req.file);
      console.log("Media uploaded to Cloudinary".green);
    }

    let voiceNoteMedia = null;
    if (req.voiceNote) {
      console.log("Processing voice note file".cyan);
      try {
        voiceNoteMedia = await uploadMessageMedia(voiceNote, true); // Pass true for audio
        console.log("Voice note uploaded to Cloudinary".green);
      } catch (error) {
        console.error("Error uploading voice note:", error); // Log the error for voice note
        return res.status(500).json({
          success: false,
          message: "Error uploading voice note",
          error: error.message,
        });
      }
    }

    // Create and save the message
    const newMessage = new Message({
      sender: req.user._id,
      receiver: receiverUser._id,
      listing: propertyListing._id,
      content,
      messageMedia: uploadedMedia ? [uploadedMedia] : [],
      voiceNote: voiceNoteMedia ? [voiceNoteMedia] : [],
    });

    await newMessage.save();

    // Create response in the structure needed by the frontend
    const formattedResponse = {
      senderId: req.user._id,
      displayImage: req.user.profilePic,
      content: newMessage.content,
      timestamp: newMessage.createdAt,
      messageMedia: newMessage.messageMedia || [],
      voiceNote: newMessage.voiceNote || [],
    };

    // Send a success response with the formatted data
    console.log("New message successfully sesaved to db".magenta)
    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: formattedResponse,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
});

const chatWithSpaceOwner = asyncHandler(async (req, res) => {
  console.log("Chat with space owner before booking".yellow);

  const user = req.user;
  const { listingId } = req.body;

  try {
      // Check if the listing exists and populate the owner
      const listing = await Listing.findById(listingId).populate("user");
      if (!listing) {
          console.log("This listing is currently not available for messaging".red);
          return res.status(404).json({
              success: false,
              message: "This listing is currently not available for messaging"
          });
      }

      console.log(`ListingId: ${listing._id}, \nSenderId: ${user._id} \nReceiverId: ${listing.user._id}`.cyan);

      // Check if an existing chat between the user and the listing owner already exists for this listing
      const existingChat = await Message.findOne({
          sender: user._id,
          receiver: listing.user._id,
          listing: listing._id
      }).sort({ createdAt: -1 }); // Sort to get the latest message

      const defaultContent = `I'm interested in the ${listing.propertyName} at ${listing.propertyLocation.city}, " " ${listing.propertyLocation.state} and have a few questions. Could you please provide more details?`

      // If there’s an existing chat, check the content of the last message
      if (existingChat) {
          const lastMessage = await Message.findOne({
              sender: user._id,
              receiver: listing.user._id,
              listing: listing._id
          }).sort({ createdAt: -1 });

          // Check if the last message content starts with "New discussion on"
          if (lastMessage && lastMessage.content.startsWith(defaultContent)) {
              // Delete the last message if it starts with "New discussion on"
              await Message.findByIdAndDelete(lastMessage._id);
              console.log(`Deleted previous message with ID: ${lastMessage._id}`.yellow);
          }
      }

      // Create a new message to start or continue the conversation
      const newChat = await Message.create({
          sender: user._id,
          receiver: listing.user._id,
          listing: listing._id,
          content: defaultContent
      });

      console.log("New chat created between space user and owner.".green);
      return res.status(201).json({
          success: true,
          message: "New chat created",
          chat: newChat // Return newly created chat
      });

  } catch (error) {
      console.error("Error initiating chat:", error);
      return res.status(500).json({
          success: false,
          message: "An error occurred while trying to initiate chat",
          error: error.message
      });
  }
});

const chatWithSpaceUser= asyncHandler(async (req, res) => {
  console.log("Chat with space owner before booking".yellow);

  const user = req.user;
  const { bookingId } = req.body;

  try {
      // Check if the listing exists and populate the owner
      const booking = await Booking.findById(bookingId).populate("user").populate("listing");
      if (!booking) {
          console.log("This booking is currently not available for messaging".red);
          return res.status(404).json({
              success: false,
              message: "This booking is currently not available for messaging"
          });
      }

      console.log(`bookingId: ${booking._id}, \nSenderId: ${user._id} \nReceiverId: ${booking.user._id}`.cyan);

      // Check if an existing chat between the user and the listing owner already exists for this listing
      const existingChat = await Message.findOne({
          sender: user._id,
          receiver: booking.user._id,
          listing: booking.listing._id
      }).sort({ createdAt: -1 }); // Sort to get the latest message

      // If there’s an existing chat, check the content of the last message
      if (existingChat) {
          const lastMessage = await Message.findOne({
              sender: user._id,
              receiver: booking.user._id,
              listing: booking.listing._id
          }).sort({ createdAt: -1 });

          if (lastMessage && lastMessage.content.startsWith("   ")) {
              await Message.findByIdAndDelete(lastMessage._id);
              console.log(`Deleted previous "New discussion on" message with ID: ${lastMessage._id}`.yellow);
          }
      }

      // Create a new message to start or continue the conversation
      const newChat = await Message.create({
          sender: user._id,
          receiver: booking.user._id,
          listing: booking.listing._id,
          content: `   `
      });

      console.log("New chat created between space user and owner.".green);
      return res.status(201).json({
          success: true,
          message: "New chat created",
          chat: newChat // Return newly created chat
      });

  } catch (error) {
      console.error("Error initiating chat:", error);
      return res.status(500).json({
          success: false,
          message: "An error occurred while trying to initiate chat",
          error: error.message
      });
  }
});

// const markMessagesAsRead = async(req, res) => {

//   console.log(colors.yellow("Updating message status to read"))

//   try {
//     const { senderId, propertyId} = req.body
//     const receiverId = req.user._id

//     if (!senderId || !propertyId) {
//       return res.status(400).json({
//           success: false,
//           message: 'SenderId and propertyId are required',
//       });
//     }
    
//     // Update all messages for this chat, regardless of sender/receiver order
//     const result = await Message.updateMany(
//       {
//           propertyId: propertyId,
//           isRead: false,
//           $or: [
//               { sender: senderId, receiver: receiverId }, // Case 1: sender is senderId, receiver is receiverId
//               { sender: receiverId, receiver: senderId }, // Case 2: sender is receiverId, receiver is senderId
//           ],
//       },
//       { $set: { isRead: true } }
//   );

//   res.status(200).json({
//       success: true,
//       message: `${result.modifiedCount} messages marked as read`,
//   });

//   } catch (error) {
    
//   }
// }

// const getMessagesForAListingPostman = asyncHandler(async (req, res) => {

//   console.log(colors.yellow("postman Getting all messages for a chat"))

//   try {
//     const {listingId, otherUserId } = req.body;

//     console.log("Current user id: ", req.user._id)
//     console.log("other user Id: ", otherUserId)
//     console.log("Listing Id: ", listingId)

//     // Find all messages between the current user and the other user for a specific listing
//     const messages = await Message.find({
//       $and: [
//         { listing: listingId }, // Messages related to the listing
//         {
//           $or: [
//             { sender: req.user._id, receiver: otherUserId },
//             { sender: otherUserId, receiver: req.user._id },
//           ],
//         },
//       ],
//     })
//       .sort({ timestamp: 1 })
//       .populate('sender', 'profilePic')
//       .exec();

//     if (!messages || messages.length === 0) {
//       console.log(colors.red("No messages available at the moment"))
//       return res.status(200).json({
//           success: true,
//           message: 'No messages found for this listing',
//           data: [],

//       })
//     }

//     for (let message of messages) {
//       if (!message.isRead) {
//         console.log("Updating message read count status".green)
//         message.isRead = true;
//         await message.save();
//       }
//     }    

//     res.status(200).json({
//         success: true,
//         message: 'Messages retrieved successfully for the listing',
//         total: messages.length,
//         data: messages.map(message => ({
//           senderId: message.sender._id,
//           displayImage: message.sender.profilePic,
//           content: message.content,
//           timestamp: message.timestamp,
//           messageMedia: message.messageMedia,
//           voiceNote: message.voiceNote,
//           isRead: message.isRead
//         })),
//     })
//     ;
//   } catch (error) {
//     console.log("Something went wrong", error);
//     return { success: false, message: "Something went wrong", error };
//   }
// });

export { 
  sendMessage, 
  spaceOwnerGetAllChats,
  spaceUserGetAllChats,
  getMessagesForAListing,
  postmanSendMessage,
  chatWithSpaceOwner,
  chatWithSpaceUser,
};

