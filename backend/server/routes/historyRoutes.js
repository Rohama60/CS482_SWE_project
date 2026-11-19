import { Router } from 'express';
import { GetGameHistoryController } from '../../src/controllers/GameHistoryController.js';

// P13 Game History: /api/history
const router = Router();

router.get('/', GetGameHistoryController);

export default router;
