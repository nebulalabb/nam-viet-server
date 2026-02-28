import { Server, Socket as IOSocket } from 'socket.io';
import { Server as HttpServer } from 'http';

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Regex patterns for allowed origins (Development only)
const DEV_ALLOWED_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/, // Localhost on any port
  /^http:\/\/127\.0\.0\.1(:\d+)?$/, // 127.0.0.1 on any port
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/, // LAN 192.168.x.x
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/ // LAN 10.x.x.x
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow non-browser requests (Postman, Mobile Apps)
  if (allowedOrigins.includes(origin)) return true; // Matches .env list

  // In Development, allow patterns for Localhost/LAN
  if (process.env.NODE_ENV === 'development') {
    return DEV_ALLOWED_PATTERNS.some((pattern) => pattern.test(origin));
  }

  // In Production, strict check only
  return false;
};

class SocketManager {
  private io!: Server;

  public init(server: HttpServer): void {
    this.io = new Server(server, {
      cors: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            console.warn(`Blocked CORS for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.io.on('connection', (socket: IOSocket) => {
      this.onConnection(socket);
    });
  }

  private onConnection(socket: IOSocket): void {
    console.log(`Socket ${socket.id} connected`);

    socket.on('disconnect', (reason) => {
      this.onDisconnect(socket, reason);
    });
  }

  private onDisconnect(socket: IOSocket, reason: string): void {
    console.log(`Socket ${socket.id} disconnected: ${reason}`);
  }

  public getServer(): Server {
    if (!this.io) {
        throw new Error('Socket.io is not initialized!')
    }
    return this.io;
  }
}

export const socketManager = new SocketManager();
