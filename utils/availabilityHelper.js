import Listing from "../models/listingModel.js";

/**
 * Validates booking availability for a given listing.
 *
 * @param {Object} params
 * @param {String} params.listingId - The ID of the listing to check availability for.
 * @param {Date} params.checkInDate - The check-in date.
 * @param {Date} params.checkOutDate - The check-out date.
 * @param {Number} params.spaceUsers - The number of guests.
 * @returns {Object} - { success: Boolean, message: String, availableDates?: Array, conflictDates?: Array }
 */
export const validateBookingAvailability = async ({ listingId, checkInDate, checkOutDate, spaceUsers }) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Normalize current date to midnight

    // Validate check-out is later than check-in
    if (checkOutDate < checkInDate) {
        return { success: false, message: "Check-out date cannot be earlier than check-in date." };
    }

    // Validate no dates are in the past
    if (checkInDate < currentDate || checkOutDate < currentDate) {
        const pastDates = [];
        if (checkInDate < currentDate) pastDates.push("checkIn");
        if (checkOutDate < currentDate) pastDates.push("checkOut");
        return { success: false, message: `The following dates are in the past: ${pastDates.join(", ")}` };
    }

    // Generate the array of dates between checkIn and checkOut
    const checkInToCheckOutDates = [];
    for (let d = new Date(checkInDate); d <= checkOutDate; d.setDate(d.getDate() + 1)) {
        checkInToCheckOutDates.push(d.toISOString().split("T")[0]);
    }

    // Fetch listing details
    const listing = await Listing.findById(listingId);

    if (!listing) {
        return { success: false, message: "Listing not found." };
    }

    if (checkInToCheckOutDates.length < listing.minimumDays) {
        return { success: false, message: `Listing is available for a minimum of ${listing.minimumDays} days.` };
    }

    const { availability = [], calendar, maximumGuestNumber } = listing;
    const { unavailableDays } = calendar;

    // Check listing availability
    if (Array.isArray(availability) && availability.length > 0) {
        const unavailableDates = checkInToCheckOutDates.filter((date) => !availability.includes(date));
        if (unavailableDates.length > 0) {
            return {
                success: false,
                message: `Listing is not available for the following dates: ${unavailableDates.join(", ")}.`,
            };
        }
    }

    // Check for conflicts with unavailable days
    const conflictDates = checkInToCheckOutDates.filter((date) => unavailableDays.includes(date));
    if (conflictDates.length > 0) {
        return {
            success: false,
            message: `Listing is unavailable for the following dates: ${conflictDates.join(", ")}.`,
            conflictDates,
        };
    }

    // Check maximum guests
    if (spaceUsers > maximumGuestNumber) {
        return {
            success: false,
            message: `The number of guests exceeds the maximum allowed. Maximum allowed is ${maximumGuestNumber}.`,
        };
    }

    return {
        success: true,
        message: "Listing is available for booking.",
        availableDates: checkInToCheckOutDates,
    };
};
