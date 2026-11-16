import { Router } from 'express';
import { CreateGuestController, GetGuestByIdController } from '../../src/controllers/GuestController.js';

const router = Router();

router.post('/', CreateGuestController);
router.get('/:id', GetGuestByIdController);

export default router;
