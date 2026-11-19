import { Router } from 'express';
import {
    GetMutesController,
    MutePlayerController,
    UnmutePlayerController,
} from '../../src/controllers/ChatMuteController.js';

// Mute Others: /api/chat/mutes
const router = Router();

router.get('/', GetMutesController);
router.post('/', MutePlayerController);
router.delete('/:playerId', UnmutePlayerController);

export default router;
