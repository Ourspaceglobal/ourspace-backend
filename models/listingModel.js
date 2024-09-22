import mongoose from "mongoose";

const propertyLocationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, "city is required"]
  },
    city: {
      type: String,
      required: [true, "city is required"]
    },
    state: {
      type: String,
      required: [true, "state is required"]
    },
    latitude: Number,
    longitude: Number,
    apartmentNumber: Number,
    apartmentSize: Number
});

const dateSchema = new mongoose.Schema({
  date: { 
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /\d{4}-\d{2}-\d{2}/.test(v); // Regex to validate YYYY-MM-DD format
      },
      message: props => `${props.value} is not a valid date format!`
    }
  }
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
      default: "listed"
    },
    listingStatus: { 
      type: String,
      enum: ["approved", "rejected","active", "inactive", "pending", "draft", "saved", "archived", "blocked"],
      default: "approved",
    },
    listedOnOtherPlatform: {
      type: Boolean,
      default: false,
      required: true
    },
    propertyName: {
      type: String,
      required: [true, 'Property name is required.']
    },
    propertyType: { 
      type: String,
      required: [true, 'Property type is required.']
    },
    bedroomTotal: {
      type: Number,
      required: true
    },
    livingRoomTotal: {
      type: Number,
      required: true
    },
    bedTotal: {
      type: Number,
      required: true
    },
    bathroomTotal: {
      type: Number,
      required: true 
    },
    toiletTotal: {
      type: Number,
      required: true
    },

    propertyLocation: propertyLocationSchema,

    description: {
      type: String
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
      required: [true, "Minimum allowed days is required"]
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
      default: "ngn",
      required: [true, "Charge currency is required"]
    },

    acceptOtherCurrency: {
      type: Boolean,
      required: [true, "Accept other currecny attestation is required"]
    },

    otherAcceptedCurrencies: [String],

    chargePerNight: {
      type: Number,
      required: [true, "How much to be charged per night is required"]
    },

    discount: {
      type: Boolean,
      default: false,
      required: [true, "discount is required"]    
    },

    cancellationOption: {
      type: String,
      enum: ['flexible', 'moderate', 'firm', 'strict'],
      default: "flexible",
      required: [true, "Cancellation option is required"]
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
      required: true
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