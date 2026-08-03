import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Tibo API server running. Use /api/tweets/today or /api/tweets/analyze' });
});

app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
