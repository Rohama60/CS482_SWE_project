import { Router } from 'express';
import {
    CreateTableController,
    GetTablesController,
    GetTableByIdController,
    DeleteTableController,
    GetMyTablesController,
    UpdateTableController,
} from '../../src/controllers/TableController.js';
import { JoinTableController, JoinByCodeController } from '../../src/controllers/JoinTableController.js';
import { SpectateTableController, StopSpectatingController } from '../../src/controllers/SpectateController.js';
import { GetChatController } from '../../src/controllers/ChatController.js';
import { LeaveTableController } from '../../src/controllers/PokerGameController.js';
import { FoldBotGamePlayerOnLeave } from '../../src/controllers/BotGameController.js';
import { GetTableBotGameController } from '../../src/controllers/BotGameController.js';

const router = Router();

router.post('/', CreateTableController);
router.get('/', GetTablesController);
router.get('/mine', GetMyTablesController);
router.post('/join-code', JoinByCodeController);
router.post('/:id/join', JoinTableController);
router.post('/:id/leave', FoldBotGamePlayerOnLeave, LeaveTableController);
router.post('/:id/spectate', SpectateTableController);
router.post('/:id/stop-spectating', StopSpectatingController);
router.get('/:id/chat', GetChatController);
router.get('/:id/bot-game', GetTableBotGameController);
router.get('/:id', GetTableByIdController);
router.put('/:id', UpdateTableController);
router.delete('/:id', DeleteTableController);

export default router;
