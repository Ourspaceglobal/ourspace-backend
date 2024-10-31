import mongoose from "mongoose";

const propertyLocationSchema = new mongoose.Schema({
  address: {
    type: String
  },
    city: {
      type: String
    },
    state: {
      type: String
    },
    latitude: Number,
    longitude: Number,
    apartmentNumber: {type: String, default: null},
    apartmentSize: {type: String, default: null}
});

const numberOfGuestsSchema = new mongoose.Schema({
  adult: { type: Number },
  children: { type: Number },
  pets: { type: Number, default: 0 },
  total: {
      type: Number,
      required: true,
      default: function() {
          return this.adult + this.children;
      }
  }
});
  
const infoForGuestsSchema = new mongoose.Schema({
  petsAllowed: Boolean,
  kidsAllowed: Boolean,
  partiesAllowed: Boolean,
  smokingAllowed: Boolean,
  cctvAvailable: Boolean
});

const imageSchema = new mongoose.Schema({
  secure_url: { type: String, required: true },
  public_id: { type: String }
});
  
const listingsSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    propertyId: {
      type: String,
      required: true
    },
    propertyUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', 
    }],
    status: {
      type: String,
      enum: ["listed", "unlisted"],
      default: "unlisted"
    },
    listingStatus: { 
      type: String,
      enum: ["approved", "rejected","active", "inactive", "pending", "draft", "saved", "marked-unavailable", "blocked"],
      default: "pending",
    },
    listedOnOtherPlatform: {
      type: Boolean,
      default: false
    },
    propertyName: {
      type: String
    },
    propertyType: { 
      type: [String],
      enum: ["house", "apartment", "resort", "guest-house", "office-space", 'bungalow', 'villa', 'loft']
    },
    bedroomTotal: {
      type: Number
    },
    livingRoomTotal: {
      type: Number
    },
    bedTotal: {
      type: Number
    },
    bathroomTotal: {
      type: Number
    },
    toiletTotal: {
      type: Number
    },

    propertyLocation: propertyLocationSchema,

    description: {
      type: String
    },

    chargePerNight: {
      type: Number
    },
    chargePerNightWithout10Percent: {
      type: Number
    },

    bedroomPictures: [imageSchema],
    livingRoomPictures: [imageSchema],
    bathroomToiletPictures: [imageSchema],
    kitchenPictures: [imageSchema],
    facilityPictures: [imageSchema],
    otherPictures: [imageSchema],

    availableAmenities: {
      propertyAmenities: [String],
      roomFeatures: [String],
      outdoorActivities: [String],
      allAmenities: [String]
    },

    arrivalDepartureDetails: {
      checkIn: {
        from: {
          type: String,
        },
        to: {
          type: String
        }
      },
      checkOut: {
        from: {
          type: String,
        },
        to: {
          type: String
        }
      }
    },

    minimumDays: {
      type: Number,
      default: 1,
    },
    
    infoForGuests: infoForGuestsSchema,

    guestMeansOfId: {
      confirmationMail: {
        type: Boolean,
        default: false
      },
      idCard: {
        type: Boolean,
        default: false
      }
    },

    chargeType: {
      type: String,
      enum: ['daily', 'weekly', 'yearly'],
      default: "daily"
    },

    chargeCurrency: {
      type: String,
      default: "ngn"
    },

    acceptOtherCurrency: {
      type: Boolean,
      default: false
    },

    otherAcceptedCurrencies: [String],

    discount: {
      type: Boolean,
      default: false, 
    },

    cancellationOption: {
      type: String,
      enum: ['flexible', 'moderate', 'firm', 'strict'],
      default: "strict",
    },

    calendar: {
      availableDays: {
        type: [String],
        default: []
      },
      blockedDays: {
        type: [String],
        default: []
      },
      bookedDays: {
        type: [String],
        default: []
      },
      unavailableDays: {
        type: [String],
        default: function() {
          return [...new Set([...this.calendar.blockedDays, ...this.calendar.bookedDays])];
        }
      }
    },

    totalGuestsAllowed: {
      type: Number,
      required: [true, "Total allowed guests is required"]
    },
    
    freeCancellation: {
      type: Boolean,
      default: false,
    },
    maximumGuestNumber: numberOfGuestsSchema,

}, {
  timestamps: true
});

listingsSchema.pre('save', function (next) {
  if (!this.availableAmenities) {
      this.availableAmenities = {};
  }

  const amenities = new Set([
    ...(this.availableAmenities.propertyAmenities || []),
    ...(this.availableAmenities.roomFeatures || []),
    ...(this.availableAmenities.outdoorActivities || [])
  ]);

  this.availableAmenities.allAmenities = Array.from(amenities);
  next();
});

listingsSchema.pre('save', function (next) {
  if (!this.calendar) {
    this.calendar = {};
  }

  // Combine blockedDays and bookedDays to form unavailableDays
  const unavailableDays = new Set([
    ...(this.calendar.blockedDays || []),
    ...(this.calendar.bookedDays || [])
  ]);

  this.calendar.unavailableDays = Array.from(unavailableDays);
  next();
});
  
const Listing = mongoose.model('Listing', listingsSchema);

export default Listing;