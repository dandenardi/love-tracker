import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { socketManager } from './socket';
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import pokeRoutes from './routes/poke';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Socket.io
socketManager.init(httpServer);

// Routes
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/poke', pokeRoutes);

app.get('/health', (req, res) => {
  res.send({ status: 'ok', service: 'Love Tracker API', timestamp: Date.now() });
});

httpServer.listen(Number(port), '0.0.0.0', () => {
  console.log(`[server]: Love Tracker Backend is running at http://0.0.0.0:${port}`);
});
