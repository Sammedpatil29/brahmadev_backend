import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO server attached to the HTTP server
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 Socket client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔴 Socket client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance
 * @returns {Server | null}
 */
export const getIo = () => {
  return io;
};

/**
 * Broadcast new lead data to all connected clients
 * @param {object} lead
 */
export const emitNewLead = (lead) => {
  if (io) {
    console.log(`📢 Broadcasting 'new-lead' event:`, lead?.id || lead);
    io.emit('new-lead', lead);
  } else {
    console.warn('⚠️ Socket.IO is not initialized yet. Cannot emit new-lead.');
  }
};

/**
 * Broadcast lead update (status, comments/messages, etc.) to all connected clients
 * @param {object} data - { leadId, response, comment, newComment, updatedBy, lead }
 */
export const emitLeadUpdate = (data) => {
  if (io) {
    console.log(`📢 Broadcasting 'lead-updated' event for lead: ${data?.leadId || data?.id}`);
    io.emit('lead-updated', data);
  } else {
    console.warn('⚠️ Socket.IO is not initialized yet. Cannot emit lead-updated.');
  }
};

