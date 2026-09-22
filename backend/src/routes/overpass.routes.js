import { Router } from 'express';
import { overpassQuery } from '../services/overpass.service.js';

export const overpassRouter = Router();

/* POST /api/overpass  { query, server? } → { elements } */
overpassRouter.post('/', async (req, res) => {
  const { query, server } = req.body ?? {};
  res.json({ elements: await overpassQuery(query, { preferred: server, signal: req.abortSignal }) });
});
