import express from 'express';
import { LoveEvent } from '@love/shared';

const app = express();
const port = 3001;

app.use(express.json());

// Dummy database for the visibility the user wanted
const events: LoveEvent[] = [];

app.get('/health', (req, res) => {
  res.send({ status: 'ok', service: 'Love Tracker API' });
});

app.get('/events', (req, res) => {
  res.json(events);
});

app.listen(port, () => {
  console.log(`[server]: Love Tracker Backend is running at http://localhost:${port}`);
});
