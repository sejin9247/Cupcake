import { Router } from 'express';
import { nominatimGet } from '../services/nominatim.service.js';

export const geoRouter = Router();

/* GET /api/geo/nominatim/:path?...  (path: search | reverse | lookup)
   쿼리 문자열은 Nominatim에 그대로 전달한다. */
geoRouter.get('/nominatim/:path', async (req, res) => {
  res.json(await nominatimGet(req.params.path, req.query, req.abortSignal));
});
