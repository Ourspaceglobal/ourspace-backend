import cron from 'node-cron';
import dayjs from 'dayjs';
import Booking from '../models/bookingModel.js';

// Function to define the cron job
export const scheduleBookingStatusUpdate = () => {
  // Run every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    console.log('Updating booking status every 12 hours'.green);

    const currentDate = dayjs().format('YYYY-MM-DD');

    try {
      // Only fetch bookings that are not completed
      const allBookings = await Booking.find({ bookingStatus: { $ne: "completed" } });

      if (!allBookings || allBookings.length < 1) {
        console.log("No booking found to be updated".green);
        return; // Stop execution if no bookings are found
      }

      // Update booking statuses
      for (let booking of allBookings) {
        const firstBookedDay = booking.bookedDays[0];
        const lastBookedDay = booking.bookedDays[booking.bookedDays.length - 1]; 

        if (currentDate < firstBookedDay) {
          // Booking is in the future
          booking.bookingStatus = 'upcoming';
        } else if (currentDate >= firstBookedDay && currentDate <= lastBookedDay) {
          // Booking is currently in-progress
          booking.bookingStatus = 'in-progress';
        } else if (currentDate > lastBookedDay) {
          // Booking is completed
          booking.bookingStatus = 'completed';
        }

        await booking.save(); // Save updates for the booking
      }

      console.log(`Total of ${allBookings.length} booking statuses successfully updated`.magenta);
    } catch (error) {
      console.error('Error updating booking status:', error.message);
    }
  });
};
