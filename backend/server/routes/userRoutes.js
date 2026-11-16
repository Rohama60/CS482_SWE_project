import { Router } from 'express';
import {
    GetUsersController,
    GetCurrentUserController,
    GetUserByIdController,
    PlayerMuteMusicController,
    FileComplaintController,
    SelfPasswordResetController,
    AdminPasswordResetController,
} from '../../src/controllers/UserController.js';
import { requireAccount } from '../../src/middleware/accountAuth.js';
import { verifyAdmin } from '../../src/controllers/AdminController.js';

const router = Router();

router.get('/', verifyAdmin, GetUsersController);
router.get('/me', requireAccount, GetCurrentUserController);
router.get('/:id', requireAccount, GetUserByIdController);
router.patch('/mute', PlayerMuteMusicController);
router.post('/complaints', FileComplaintController);
router.post('/reset-password', SelfPasswordResetController);

export default router;
