export const formatListingData = (req) => {
  const formatDate = (year, month, day) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const safeParseInt = (value) => {
    if (value === undefined || value === null || isNaN(parseInt(value, 10))) {
      return undefined; // Or any default value that makes sense for your context.
    }
    return parseInt(value, 10);
  };

  const safeParseFloat = (value) => {
    if (value === undefined || value === null || isNaN(parseFloat(value))) {
      return undefined; // Or any default value that makes sense for your context.
    }
    return parseFloat(value);
  };

  return {
    user: req.body.user,
    propertyName: req.body.propertyName,
    propertyType: Array.isArray(req.body.propertyType)
      ? req.body.propertyType.map(type => type.trim().toLowerCase())
      : req.body.propertyType
      ? req.body.propertyType.split(',').map(type => type.trim().toLowerCase())
      : [],
    bedroomTotal: safeParseInt(req.body.bedroomTotal),
    livingRoomTotal: safeParseInt(req.body.livingRoomTotal),
    bedTotal: safeParseInt(req.body.bedTotal),
    toiletTotal: safeParseInt(req.body.toiletTotal),
    bathroomTotal: safeParseInt(req.body.bathroomTotal),
    freeCancellation: req.body.freeCancellation === 'true' || req.body.freeCancellation === true,
    totalGuestsAllowed: safeParseInt(req.body.totalGuestsAllowed),

    propertyLocation: {
      address: req.body['propertyLocation.address'],
      city: req.body['propertyLocation.city'],
      state: req.body['propertyLocation.state'],
      apartmentNumber: req.body['propertyLocation.apartmentNumber'] ? (req.body['propertyLocation.apartmentNumber']) : null,
      apartmentSize: req.body['propertyLocation.apartmentSize'] ? (req.body['propertyLocation.apartmentSize']) : null
    },

    description: req.body.description,

    availableAmenities: {
      propertyAmenities: Array.isArray(req.body.propertyAmenities)
        ? req.body.propertyAmenities.map(item => item.trim())
        : req.body.propertyAmenities
        ? req.body.propertyAmenities.split(',').map(item => item.trim())
        : [],
      roomFeatures: Array.isArray(req.body.roomFeatures)
        ? req.body.roomFeatures.map(item => item.trim())
        : req.body.roomFeatures
        ? req.body.roomFeatures.split(',').map(item => item.trim())
        : [],
      outdoorActivities: Array.isArray(req.body.outdoorActivities)
        ? req.body.outdoorActivities.map(item => item.trim())
        : req.body.outdoorActivities
        ? req.body.outdoorActivities.split(',').map(item => item.trim())
        : []
    },

    arrivalDepartureDetails: {
      checkIn: {
        from: req.body["arrivalDepartureDetails.checkIn.from"],
        to: req.body["arrivalDepartureDetails.checkIn.to"]
      }, 
      checkOut: {
        from: req.body["arrivalDepartureDetails.checkOut.from"],
        to: req.body["arrivalDepartureDetails.checkOut.to"]
      }
    },

    minimumDays: safeParseInt(req.body.minimumDays),

    infoForGuests: {
      petsAllowed: req.body['infoForGuests.petsAllowed'],
      kidsAllowed: req.body['infoForGuests.kidsAllowed'],
      partiesAllowed: req.body['infoForGuests.partiesAllowed'],
      smokingAllowed: req.body['infoForGuests.smokingAllowed'],
      cctvAvailable: req.body['infoForGuests.cctvAvailable']
    },

    guestMeansOfId: {
      confirmationMail: req.body['guestMeansOfId.confirmationMail'],
      idCard: req.body['guestMeansOfId.idCard']
    },

    chargeType: req.body.chargeType,
    chargeCurrency: req.body.chargeCurrency,
    acceptOtherCurrency: req.body.acceptOtherCurrency === 'true' || req.body.acceptOtherCurrency === true,
    
    otherAcceptedCurrencies: Array.isArray(req.body.otherAcceptedCurrencies)
      ? req.body.otherAcceptedCurrencies
      : req.body.otherAcceptedCurrencies
          ? req.body.otherAcceptedCurrencies.split(',')
          : [],

    chargePerNight: safeParseFloat(req.body.chargePerNight),

    discount: req.body.discount === 'true' || req.body.discount === true,

    cancellationOption: req.body.cancellationOption,

    calendar: {
      availableDays: Array.isArray(req.body['calendar.availableDays'])
        ? req.body['calendar.availableDays']
        : req.body['calendar.availableDays']
          ? req.body['calendar.availableDays'].split(',').map(date => date.trim())
          : [],

      blockedDays: Array.isArray(req.body['calendar.blockedDays'])
        ? req.body['calendar.blockedDays']
        : req.body['calendar.blockedDays']
          ? req.body['calendar.blockedDays'].split(',').map(date => date.trim())
          : [],

      bookedDays: Array.isArray(req.body['calendar.bookedDays'])
        ? req.body['calendar.bookedDays']
        : req.body['calendar.bookedDays']
          ? req.body['calendar.bookedDays'].split(',').map(date => date.trim())
          : []
    },
  };
};

export const formatSaveForLaterListingData = (req) => {
  const formattedData = {};

  const safeParseInt = (value) => {
    if (value === undefined || value === null || isNaN(parseInt(value, 10))) {
      return undefined;
    }
    return parseInt(value, 10);
  };

  const safeParseFloat = (value) => {
    if (value === undefined || value === null || isNaN(parseFloat(value))) {
      return undefined;
    }
    return parseFloat(value);
  };

  // Only add fields that are present in the request
  if (req.body.user) formattedData.user = req.body.user;
  if (req.body.propertyName) formattedData.propertyName = req.body.propertyName;
  if (req.body.propertyType) {
    formattedData.propertyType = Array.isArray(req.body.propertyType)
      ? req.body.propertyType
      : req.body.propertyType.split(',').map(type => type.trim());
  }
  if (req.body.bedroomTotal) formattedData.bedroomTotal = safeParseInt(req.body.bedroomTotal);
  if (req.body.livingRoomTotal) formattedData.livingRoomTotal = safeParseInt(req.body.livingRoomTotal);
  if (req.body.bedTotal) formattedData.bedTotal = safeParseInt(req.body.bedTotal);
  if (req.body.toiletTotal) formattedData.toiletTotal = safeParseInt(req.body.toiletTotal);
  if (req.body.bathroomTotal) formattedData.bathroomTotal = safeParseInt(req.body.bathroomTotal);
  if (req.body.freeCancellation) formattedData.freeCancellation = req.body.freeCancellation === 'true' || req.body.freeCancellation === true;
  if (req.body.totalGuestsAllowed) formattedData.totalGuestsAllowed = safeParseInt(req.body.totalGuestsAllowed);

  // Property Location
  if (req.body['propertyLocation.address'] || req.body['propertyLocation.city'] || req.body['propertyLocation.state'] || req.body['propertyLocation.apartmentNumber'] || req.body['propertyLocation.apartmentSize']) {
    formattedData.propertyLocation = {};
    if (req.body['propertyLocation.address']) formattedData.propertyLocation.address = req.body['propertyLocation.address'];
    if (req.body['propertyLocation.city']) formattedData.propertyLocation.city = req.body['propertyLocation.city'];
    if (req.body['propertyLocation.state']) formattedData.propertyLocation.state = req.body['propertyLocation.state'];
    if (req.body['propertyLocation.apartmentNumber']) formattedData.propertyLocation.apartmentNumber = (req.body['propertyLocation.apartmentNumber']);
    if (req.body['propertyLocation.apartmentSize']) formattedData.propertyLocation.apartmentSize = (req.body['propertyLocation.apartmentSize']);
  }

  if (req.body.description) formattedData.description = req.body.description;

  // Available Amenities
  if (!formattedData.availableAmenities) {
    formattedData.availableAmenities = {};
  }

  // Update propertyAmenities if provided
  if (req.body.propertyAmenities) {
    formattedData.availableAmenities.propertyAmenities = Array.isArray(req.body.propertyAmenities)
      ? req.body.propertyAmenities.map(item => item.trim())
      : req.body.propertyAmenities.split(',').map(item => item.trim());
  }

  // Update roomFeatures if provided
  if (req.body.roomFeatures) {
    formattedData.availableAmenities.roomFeatures = Array.isArray(req.body.roomFeatures)
      ? req.body.roomFeatures.map(item => item.trim())
      : req.body.roomFeatures.split(',').map(item => item.trim());
  }

  // Update outdoorActivities if provided
  if (req.body.outdoorActivities) {
    formattedData.availableAmenities.outdoorActivities = Array.isArray(req.body.outdoorActivities)
      ? req.body.outdoorActivities.map(item => item.trim())
      : req.body.outdoorActivities.split(',').map(item => item.trim());
  }

  // Ensure allAmenities includes all provided amenities
  formattedData.availableAmenities.allAmenities = [
    ...(formattedData.availableAmenities.propertyAmenities || []),
    ...(formattedData.availableAmenities.roomFeatures || []),
    ...(formattedData.availableAmenities.outdoorActivities || [])
  ];

  // Arrival Departure Details
  if (req.body['arrivalDepartureDetails.checkIn.from'] || req.body['arrivalDepartureDetails.checkIn.to'] ||
      req.body['arrivalDepartureDetails.checkOut.from'] || req.body['arrivalDepartureDetails.checkOut.to']) {
    formattedData.arrivalDepartureDetails = {
      checkIn: {},
      checkOut: {}
    };
    if (req.body['arrivalDepartureDetails.checkIn.from']) formattedData.arrivalDepartureDetails.checkIn.from = req.body['arrivalDepartureDetails.checkIn.from'];
    if (req.body['arrivalDepartureDetails.checkIn.to']) formattedData.arrivalDepartureDetails.checkIn.to = req.body['arrivalDepartureDetails.checkIn.to'];
    if (req.body['arrivalDepartureDetails.checkOut.from']) formattedData.arrivalDepartureDetails.checkOut.from = req.body['arrivalDepartureDetails.checkOut.from'];
    if (req.body['arrivalDepartureDetails.checkOut.to']) formattedData.arrivalDepartureDetails.checkOut.to = req.body['arrivalDepartureDetails.checkOut.to'];
  }

  if (req.body.minimumDays) formattedData.minimumDays = safeParseInt(req.body.minimumDays);

  // Info For Guests
  if (req.body['infoForGuests.petsAllowed'] || req.body['infoForGuests.kidsAllowed'] ||
      req.body['infoForGuests.partiesAllowed'] || req.body['infoForGuests.smokingAllowed'] ||
      req.body['infoForGuests.cctvAvailable']) {
    formattedData.infoForGuests = {};
    if (req.body['infoForGuests.petsAllowed']) formattedData.infoForGuests.petsAllowed = req.body['infoForGuests.petsAllowed'];
    if (req.body['infoForGuests.kidsAllowed']) formattedData.infoForGuests.kidsAllowed = req.body['infoForGuests.kidsAllowed'];
    if (req.body['infoForGuests.partiesAllowed']) formattedData.infoForGuests.partiesAllowed = req.body['infoForGuests.partiesAllowed'];
    if (req.body['infoForGuests.smokingAllowed']) formattedData.infoForGuests.smokingAllowed = req.body['infoForGuests.smokingAllowed'];
    if (req.body['infoForGuests.cctvAvailable']) formattedData.infoForGuests.cctvAvailable = req.body['infoForGuests.cctvAvailable'];
  }

  if (req.body.chargeType) formattedData.chargeType = req.body.chargeType;

  if (req.body['guestMeansOfId.confirmationMail'] || req.body['guestMeansOfId.idCard']) {
    formattedData.guestMeansOfId = {
      confirmationMail: req.body['guestMeansOfId.confirmationMail'],
      idCard: req.body['guestMeansOfId.idCard']
    };
  }

  if (req.body.chargeCurrency) formattedData.chargeCurrency = req.body.chargeCurrency;
  if (req.body.acceptOtherCurrency !== undefined) formattedData.acceptOtherCurrency = req.body.acceptOtherCurrency === 'true' || req.body.acceptOtherCurrency === true;

  if (req.body.otherAcceptedCurrencies) {
    formattedData.otherAcceptedCurrencies = Array.isArray(req.body.otherAcceptedCurrencies)
      ? req.body.otherAcceptedCurrencies
      : req.body.otherAcceptedCurrencies.split(',');
  }

  if (req.body.chargePerNight) formattedData.chargePerNight = safeParseFloat(req.body.chargePerNight);

  if (req.body.discount) formattedData.discount = req.body.discount === 'true' || req.body.discount === true;

  if (req.body.cancellationOption) formattedData.cancellationOption = req.body.cancellationOption;

  // Calendar
  if (req.body['calendar.availableDays'] || req.body['calendar.blockedDays'] || req.body['calendar.bookedDays']) {
    formattedData.calendar = {};
    if (req.body['calendar.availableDays']) {
      formattedData.calendar.availableDays = Array.isArray(req.body['calendar.availableDays'])
        ? req.body['calendar.availableDays']
        : req.body['calendar.availableDays'].split(',').map(date => date.trim());
    }
    if (req.body['calendar.blockedDays']) {
      formattedData.calendar.blockedDays = Array.isArray(req.body['calendar.blockedDays'])
        ? req.body['calendar.blockedDays']
        : req.body['calendar.blockedDays'].split(',').map(date => date.trim());
    }
    if (req.body['calendar.bookedDays']) {
      formattedData.calendar.bookedDays = Array.isArray(req.body['calendar.bookedDays'])
        ? req.body['calendar.bookedDays']
        : req.body['calendar.bookedDays'].split(',').map(date => date.trim());
    }
  }
  return formattedData;
};

