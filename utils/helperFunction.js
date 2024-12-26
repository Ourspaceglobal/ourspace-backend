import pdf from 'html-pdf';
import { generateBookingPDFHtml, generateWithdrawalPDFHtml } from "../email_templates/invoicePdf.js";
import { parseISO, format, addDays } from 'date-fns';

// Function to format the date
export const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',  // e.g. "Aug"
      day: 'numeric',  // e.g. "16"
      year: 'numeric', // e.g. "2022"
      hour: 'numeric',  // e.g. "10"
      minute: 'numeric', // e.g. "23"
      hour12: true  // e.g. "10:23 AM"
    });
};
export const formatDateForSUTransactionHistory = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',  // e.g. "Aug"
      day: 'numeric',  // e.g. "16"
      year: 'numeric', // e.g. "2022"
    });
};

export const formatDateWithoutTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',  // e.g. "Aug"
      day: 'numeric',  // e.g. "16"
      weekday: 'short' // e.g "Wed"
      // year: 'numeric', // Uncomment if you want to include the year
      // hour: 'numeric',  // Remove these lines to exclude time
      // minute: 'numeric', // Remove these lines to exclude time
      // hour12: true // Remove this line if you don't want AM/PM
    });
};

export const formatBookedDays = (bookedDays) => {
    if (bookedDays.length < 1) return "";

    const startDate = parseISO(bookedDays[0]);
    let endDate;

    if (bookedDays.length === 1) {
        // If only one day is booked, the end date should be the next day
        endDate = addDays(startDate, 1);
    } else {
        // Otherwise, use the last day in the array
        endDate = parseISO(bookedDays[bookedDays.length - 1]);
    }

    // Format each date using 'E. MMM d, yyyy' pattern
    const startDateFormatted = format(startDate, "EEE. MMM d, yyyy");
    const endDateFormatted = format(endDate, "EEE. MMM d, yyyy");

    return `${startDateFormatted} - ${endDateFormatted}`;
};

// Example usage
const bookedDays = ["2024-11-24", "2024-11-26"];
const formattedRange = formatBookedDays(bookedDays);
console.log(formattedRange);  // Output: "Sun. Nov 24, 2024 - Tue. Nov 26, 2024"
  
// Function to format the amount with commas
export const formatAmount = (amount) => {
return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const generateBookingInvoicePDF = (bookingData, res) => {

    const html = generateBookingPDFHtml(bookingData);

    const options = {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm"
        }
    };

    pdf.create(html, options).toFile(`./invoices/invoice-${bookingData.invoiceId}.pdf`, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error creating PDF' });
        }
        res.download(result.filename); // Automatically download the generated PDF
    });
};

export const generateWithdrawalInvoicePDF = (withdrawalData, res) => {

    const html = generateWithdrawalPDFHtml(withdrawalData);

    const options = {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm"
        }
    };

    pdf.create(html, options).toFile(`./invoices/invoice-${withdrawalData.invoiceId}.pdf`, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error creating PDF' });
        }
        res.download(result.filename); // Automatically download the generated PDF
    });
};

  
  