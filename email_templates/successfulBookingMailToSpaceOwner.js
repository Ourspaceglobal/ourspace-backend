export const successfulBookingMailToSpaceOwner = async (spaceUserName, apartmentName, totalNight, daysBooked, totalPaid) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
                  color: #333;
              }
              .email-container {
                  width: 100%;
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              }
              .email-header {
                  text-align: center;
                  background-color: #342fc4;
                  color: white;
                  padding: 10px;
                  border-top-left-radius: 8px;
                  border-top-right-radius: 8px;
              }
              .email-body {
                  padding: 20px;
                  line-height: 1.6;
                  color: #555;
              }
              .email-footer {
                  text-align: center;
                  margin-top: 20px;
                  font-size: 12px;
                  color: #777;
              }
              .highlight {
                  color: #342fc4;
                  font-weight: bold;
              }
              .cta-button {
                  display: inline-block;
                  margin-top: 20px;
                  padding: 12px 24px;
                  background-color: #342fc4;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  font-size: 16px;
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="email-header">
                  <h2>New Booking Confirmed</h2>
              </div>
              <div class="email-body">
                  <p>Dear Space Owner,</p>
                  <p>We are excited to inform you that <span class="highlight">${spaceUserName}</span> has successfully booked your apartment, <span class="highlight">${apartmentName}</span>.</p>
                  <p><strong>Booking Details:</strong></p>
                  <ul>
                      <li><strong>Total Nights:</strong> ${totalNight}</li>
                      <li><strong>Booked Dates:</strong> ${daysBooked}</li>
                      <li><strong>Total Paid:</strong> #${totalPaid}</li>
                  </ul>
                  <p>Please make sure that the apartment is ready and well-prepared for the guest's arrival. You can log in to your account to view more details and manage the booking.</p>
                  <p>If you have any questions or need assistance, feel free to <a href="mailto:ourspacegloballtd@gmail.com">contact our support team</a>.</p>
              </div>
              <div class="email-footer">
                  <p>Thank you for using ourspace to list your property!</p>
                  <p>&copy; 2024 ourspace. All Rights Reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  };

  export const successfulBookingMailToSuperAdmin = async (spaceUserName, apartmentName, totalNight, daysBooked, totalPaid, spaceUserEmail, spaceOwnerName, spaceOwnerEmail) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
                  color: #333;
              }
              .email-container {
                  width: 100%;
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              }
              .email-header {
                  text-align: center;
                  background-color: #342fc4;
                  color: white;
                  padding: 10px;
                  border-top-left-radius: 8px;
                  border-top-right-radius: 8px;
              }
              .email-body {
                  padding: 20px;
                  line-height: 1.6;
                  color: #555;
              }
              .email-footer {
                  text-align: center;
                  margin-top: 20px;
                  font-size: 12px;
                  color: #777;
              }
              .highlight {
                  color: #342fc4;
                  font-weight: bold;
              }
              .cta-button {
                  display: inline-block;
                  margin-top: 20px;
                  padding: 12px 24px;
                  background-color: #342fc4;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  font-size: 16px;
                  text-align: center;
              }
                  .cta-button-green{
                  display: inline-block;
                  margin-top: 20px;
                  padding: 12px 24px;
                  background-color: green;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  font-size: 16px;
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="email-header">
                  <h2>New Booking Confirmed</h2>
              </div>
              <div class="email-body">
                  <p>Dear super Admin, </p>
                  <p>We are excited to inform you that <span class="highlight">${spaceUserName}</span> has successfully made a new booking for the apartment <span class="highlight">${apartmentName}</span>.</p>
                  <p><strong>Booking Details:</strong></p>
                  <ul>
                      <li><strong>Total Nights:</strong> ${totalNight}</li>
                      <li><strong>Booked Dates:</strong> ${daysBooked}</li>
                      <li><strong>Total Paid:</strong> #${totalPaid}</li>
                  </ul>

                  <p>Here is the details of the Host</p>
                  <ul>
                      <li><strong>Host:</strong> ${spaceOwnerName}</li>
                      <li><strong>Email:</strong> ${spaceOwnerEmail}</li>
                  </ul>
                  
                  <a href="mailto:${spaceOwnerEmail}" class="cta-button">Contact Host</a>
                  <a href="mailto:${spaceUserEmail}" class="cta-button-green">Contact Space User</a>
              </div>
              <div class="email-footer">
                  <p>Thank you for using ourspace to list your property!</p>
                  <p>&copy; 2024 ourspace. All Rights Reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  };