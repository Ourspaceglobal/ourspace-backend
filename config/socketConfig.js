import { 
  getMessagesForAListing,
  sendMessage,
  spaceOwnerGetAllChats,
  spaceUserGetAllChats,
 } from "../controllers/messageCtrlr.js";


let users = [];

const socketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log("A user connected".yellow);

    // Space owner chat events
    socket.on('so-get-all-chats', async (data) => {
      const res = await spaceOwnerGetAllChats(data);
      console.log("Emitting data to Isiaq".blue);
      io.emit("so-get-all-chats", res);
    });

    // Space user chat events
    socket.on('su-get-all-chats', async (data) => {
      const res = await spaceUserGetAllChats(data);
      console.log("Emitting data to Isiaq".blue);
      io.emit("su-get-all-chats", res);
    });

    // Conversations between users
    socket.on('conversations', async (data) => {
      const res = await getMessagesForAListing(data);
      console.log("Emitting conversations for a listing to Isiaq".blue);
      io.emit("conversations", res);
    });

    // Typing event
    socket.on('typing', (data) => {
      const { senderName, receiverId } = data;
    
      // Broadcast only to the receiver's room (so only the receiver gets the typing notification)
      io.to(receiverId).emit('typing-response', `${senderName} is typing...`);
    });

    
    // Handling the 'send-message' socket event
    socket.on('send-message', async (data) => {
      // Log the incoming message data
      console.log(`New socket message received: ${JSON.stringify(data)}`.yellow); 

      const { sender, listingId, content, receiverId } = data;

      // Log key parts of the message for debugging
      console.log(`sender: ${sender}`.blue);
      console.log(`receiverId: ${receiverId}`.cyan);
      console.log(`listingId: ${listingId}`.green);
      console.log(`content: ${content}`.magenta);

      // Send message and get response
      const res = await sendMessage(data); 

      // Emit the formatted message to both sender and receiver
      socket.emit('message-response', res); 
      socket.emit('message-response', res);  // Emit to sender

      console.log(`Message successfully emitted to sender and receiver.`.green);
    });

    

    // New user joins
    socket.on('newUser', (data) => {
      users.push(data);
      console.log("Updated users:", users);
      io.emit('newUserResponse', users);
    });

    // Disconnection
    socket.on('disconnect', () => {
      console.log('🔥: A user disconnected:', socket.id);
      users = users.filter(user => user.socketID !== socket.id);
    });

    // Join room by userId
    socket.on('join', (userId) => {
      socket.join(userId); // Join a room based on userId
      console.log(`User with ID ${userId} joined their room`);
    });
  });
};

export default socketHandlers;
