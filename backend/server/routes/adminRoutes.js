import { Router } from 'express';
import {
    verifyAdmin,
    GetAdminUsersController,
    DeleteAdminUserController,
    UpdateAdminUserBalanceController,
} from '../../src/controllers/AdminController.js';
import { AdminPasswordResetController } from '../../src/controllers/UserController.js';
import { GetAdminAdClickStatsController } from '../../src/controllers/AdRewardController.js';

const router = Router();

router.post('/reset-password', AdminPasswordResetController);
router.get('/ads', verifyAdmin, GetAdminAdClickStatsController);
router.get('/users', verifyAdmin, GetAdminUsersController);
router.delete('/users/:id', verifyAdmin, DeleteAdminUserController);
router.patch('/users/:id/balance', verifyAdmin, UpdateAdminUserBalanceController);

export default router;
