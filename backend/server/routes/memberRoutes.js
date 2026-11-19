import { Router } from 'express';
import {
    PlayerMuteMusicController,
    FileComplaintController,
    SelfPasswordResetController,
} from '../../src/controllers/UserController.js';
import { GetLeaderboardController } from '../../src/controllers/LeaderboardController.js';

const router = Router();

router.get('/leaderboard', GetLeaderboardController);
router.patch('/users/mute', PlayerMuteMusicController);
router.post('/complaints', FileComplaintController);
router.post('/auth/reset-password', SelfPasswordResetController);

export default router;
