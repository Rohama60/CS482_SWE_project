import { Router } from 'express';
import {
    PlayerMuteMusicController,
    FileComplaintController,
    SelfPasswordResetController,
} from '../../src/controllers/UserController.js';

const router = Router();

router.patch('/users/mute', PlayerMuteMusicController);
router.post('/complaints', FileComplaintController);
router.post('/auth/reset-password', SelfPasswordResetController);

export default router;
