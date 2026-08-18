import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import pokeRoutes from './routes/poke';
import insightsRoutes from './routes/insights';
import entitlementsRoutes from './routes/entitlements';
import webhooksRoutes from './routes/webhooks';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/poke', pokeRoutes);
app.use('/insights', insightsRoutes);
app.use('/entitlements', entitlementsRoutes);
app.use('/webhooks', webhooksRoutes);

app.get('/health', (req, res) => {
  res.send({ status: 'ok', service: 'Love Tracker API', timestamp: Date.now() });
});

export default app;
