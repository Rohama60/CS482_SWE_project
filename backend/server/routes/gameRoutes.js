import { Router } from 'express';
import {
    CreatePokerGameController,
    GetPlayerHandController,
    GetPlayerChipsController,
} from '../../src/controllers/PokerGameController.js';
import {
    CreateBotGameController,
    BotGameActionController,
    BotGameDrawController,
    GetBotGameController,
} from '../../src/controllers/BotGameController.js';

const router = Router();

router.post('/', CreatePokerGameController);
router.get('/:gameId/hand', GetPlayerHandController);

export const botGameRouter = Router();
botGameRouter.post('/', CreateBotGameController);
botGameRouter.post('/:gameId/action', BotGameActionController);
botGameRouter.post('/:gameId/draw', BotGameDrawController);
botGameRouter.get('/:gameId', GetBotGameController);

export const playerRouter = Router();
playerRouter.get('/me/chips', GetPlayerChipsController);

export default router;
