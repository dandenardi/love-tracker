import dotenv from 'dotenv';
import { createServer } from 'http';
import { socketManager } from './socket';
import app from './app';

dotenv.config();

const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// Initialize Socket.io
socketManager.init(httpServer);

httpServer.listen(Number(port), '0.0.0.0', () => {
  console.log(`[server]: Love Tracker Backend is running at http://0.0.0.0:${port}`);
});
