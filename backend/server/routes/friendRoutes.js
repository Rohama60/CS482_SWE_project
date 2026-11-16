import { Router } from 'express';
import {
    GetFriendsController,
    GetFriendRequestsController,
    SendFriendRequestController,
    AcceptFriendRequestController,
    DeclineFriendRequestController,
    RemoveFriendController,
} from '../../src/controllers/FriendController.js';

const router = Router();

router.get('/', GetFriendsController);
router.get('/requests', GetFriendRequestsController);
router.post('/requests', SendFriendRequestController);
router.post('/requests/:id/accept', AcceptFriendRequestController);
router.post('/requests/:id/decline', DeclineFriendRequestController);
router.delete('/:friendId', RemoveFriendController);

export default router;
