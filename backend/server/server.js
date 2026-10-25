import '../src/loadEnv.js';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { toNodeHandler } from 'better-auth/node';
import { auth, mongoClient } from '../src/Auth.js';
import { LoginController } from '../src/controllers/LoginController.js';
import { SignUpController } from '../src/controllers/SignUpController.js';
import { CreateTableController , GetTablesController, GetTableByIdController, DeleteTableController, GetMyTablesController, UpdateTableController} from '../src/controllers/TableController.js';
import { JoinTableController, JoinByCodeController } from '../src/controllers/JoinTableController.js';
import { SpectateTableController, StopSpectatingController } from '../src/controllers/SpectateController.js';
import { CreateGuestController, GetGuestByIdController } from '../src/controllers/GuestController.js';
import { PlayerMuteMusicController, FileComplaintController, SelfPasswordResetController, AdminPasswordResetController } from '../src/controllers/UserController.js';
const app = express();
const PORT = process.env.PORT || 3000;



app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.all('/api/auth/{*splat}', toNodeHandler(auth));
app.use(express.json());
app.use((req, res, next) => {
    console.log("REQUEST RECEIVED:", req.method, req.url);
    next();
});

app.post('/api/signup', SignUpController);
app.post('/api/login', LoginController);
app.post('/api/tables', CreateTableController);
app.get('/api/tables', GetTablesController);
app.get('/api/tables/mine', GetMyTablesController);
app.post('/api/tables/join-code', JoinByCodeController);
app.post('/api/tables/:id/join', JoinTableController);
app.post('/api/tables/:id/spectate', SpectateTableController);
app.post('/api/tables/:id/stop-spectating', StopSpectatingController);
app.get('/api/tables/:id', GetTableByIdController);
app.put('/api/tables/:id', UpdateTableController);
app.delete('/api/tables/:id', DeleteTableController);

app.post('/api/guests', CreateGuestController);
app.get('/api/guests/:id', GetGuestByIdController);

app.patch('/api/users/mute', PlayerMuteMusicController);
app.post('/api/complaints', FileComplaintController);
app.post('/api/auth/reset-password', SelfPasswordResetController);
app.post('/api/admin/reset-password', AdminPasswordResetController);


async function startingServer() {
    try{
        await mongoClient.connect();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('Connected to MongoDB');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}
startingServer();
