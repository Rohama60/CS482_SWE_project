import { Router } from 'express';
import {
    verifyAdmin,
    GetAdminUsersController,
    DeleteAdminUserController,
    UpdateAdminPlayerController,
    AdminPasswordResetController,
    UpdateAdminUserBalanceController,
} from '../../src/controllers/AdminController.js';
import { GetAdminAdClickStatsController } from '../../src/controllers/AdRewardController.js';

const router = Router();

router.post('/reset-password', verifyAdmin, AdminPasswordResetController);
router.get('/ads', verifyAdmin, GetAdminAdClickStatsController);
router.get('/users', verifyAdmin, GetAdminUsersController);
router.delete('/users/:id', verifyAdmin, DeleteAdminUserController);
router.patch('/users/:id/balance', verifyAdmin, UpdateAdminUserBalanceController);
router.patch('/players/:id', verifyAdmin, UpdateAdminPlayerController);
router.delete('/players/:id', verifyAdmin, DeleteAdminUserController);

export default router;
