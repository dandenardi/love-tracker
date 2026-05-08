import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

/**
 * Socket Manager
 * Handles real-time connections and provides methods to emit events to specific users.
 */
class SocketManager {
  private io: Server | null = null;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // In production, refine this
        methods: ['GET', 'POST'],
      },
    });

    // Authentication Middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      jwt.verify(token, process.env.JWT_SECRET as string, (err: any, decoded: any) => {
        if (err) {
          return next(new Error('Authentication error: Invalid token'));
        }
        (socket as any).userId = decoded.id;
        next();
      });
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      if (!userId) return;

      console.log(`[Socket] User connected: ${userId} (${socket.id})`);

      // Register socket ID
      const sockets = this.userSockets.get(userId) || [];
      this.userSockets.set(userId, [...sockets, socket.id]);

      socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
        const currentSockets = this.userSockets.get(userId) || [];
        const updatedSockets = currentSockets.filter((id) => id !== socket.id);
        if (updatedSockets.length > 0) {
          this.userSockets.set(userId, updatedSockets);
        } else {
          this.userSockets.delete(userId);
        }
      });
    });
  }

  /**
   * Emit an event to all connected sockets of a specific user.
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.io) return;
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach((id) => {
        this.io?.to(id).emit(event, data);
      });
    }
  }

  /**
   * Helper to check if a user is currently online (has at least one socket).
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}

export const socketManager = new SocketManager();
