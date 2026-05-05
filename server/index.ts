import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import pokeRoutes from './routes/poke';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/poke', pokeRoutes);

app.get('/health', (req, res) => {
  res.send({ status: 'ok', service: 'Love Tracker API', timestamp: Date.now() });
});

app.listen(port, () => {
  console.log(`[server]: Love Tracker Backend is running at http://localhost:${port}`);
});
