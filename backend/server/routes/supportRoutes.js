import { Router } from 'express';
import { verifyAdmin } from '../../src/controllers/AdminController.js';
import {
    GetMySupportController,
    GetMyUnreadController,
    SendSupportMessageController,
    GetSupportInboxController,
    GetSupportConversationController,
    ReplySupportController,
} from '../../src/controllers/SupportController.js';

// P18 Chat with Admin
// Players: /api/support
export const supportRouter = Router();
supportRouter.get('/', GetMySupportController);
supportRouter.get('/unread', GetMyUnreadController);
supportRouter.post('/', SendSupportMessageController);

// Admins: /api/admin/support (Ayana's verifyAdmin lets only admins through)
export const adminSupportRouter = Router();
adminSupportRouter.get('/', verifyAdmin, GetSupportInboxController);
adminSupportRouter.get('/:playerId', verifyAdmin, GetSupportConversationController);
adminSupportRouter.post('/:playerId', verifyAdmin, ReplySupportController);
