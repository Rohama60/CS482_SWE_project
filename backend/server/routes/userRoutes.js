import express, { Router } from 'express';
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
import {
    EquipProfileAvatarController,
    GetProfileController,
    UploadProfileAvatarController,
} from '../../src/controllers/ProfileController.js';

const router = Router();
function handleAvatarUploadError(error, _req, res, next) {
    if (error?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Choose an image smaller than 5 MB.' });
    }
    return next(error);
}

router.get('/', verifyAdmin, GetUsersController);
router.get('/me/profile', requireAccount, GetProfileController);
router.patch('/me/profile/avatar', requireAccount, EquipProfileAvatarController);
router.put(
    '/me/profile/avatar',
    requireAccount,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
    handleAvatarUploadError,
    UploadProfileAvatarController,
);
router.get('/me', requireAccount, GetCurrentUserController);
router.get('/:id', requireAccount, GetUserByIdController);
router.patch('/mute', PlayerMuteMusicController);
router.post('/complaints', FileComplaintController);
router.post('/reset-password', SelfPasswordResetController);

export default router;
