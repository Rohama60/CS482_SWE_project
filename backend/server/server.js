import '../src/loadEnv.js';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import Table from '../src/models/TableModel.js';
import Account from '../src/models/AccountModel.js';
import Guest from '../src/models/GuestModel.js';
import { toNodeHandler } from 'better-auth/node';
import { auth, mongoClient } from '../src/Auth.js';
import { LoginController } from '../src/controllers/LoginController.js';
import { GetChatController, registerChatHandlers } from '../src/controllers/ChatController.js';
import { GetFriendsController, GetFriendRequestsController, SendFriendRequestController, AcceptFriendRequestController, DeclineFriendRequestController, RemoveFriendController } from '../src/controllers/FriendController.js';
import { SignUpController } from '../src/controllers/SignUpController.js';
import { CreateTableController , GetTablesController, GetTableByIdController, DeleteTableController, GetMyTablesController, UpdateTableController} from '../src/controllers/TableController.js';
import { JoinTableController, JoinByCodeController } from '../src/controllers/JoinTableController.js';
import { SpectateTableController, StopSpectatingController } from '../src/controllers/SpectateController.js';
import { CreateGuestController, GetGuestByIdController } from '../src/controllers/GuestController.js';
import { PlayerMuteMusicController, FileComplaintController, SelfPasswordResetController, AdminPasswordResetController } from '../src/controllers/UserController.js';
import { CreatePokerGameController, LeaveTableController, GetPlayerChipsController } from '../src/controllers/PokerGameController.js';  
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { GetPlayerHandController } from '../src/controllers/PokerGameController.js';
import { CreateBotGameController, BotGameActionController, BotGameDrawController, GetBotGameController, GetTableBotGameController, FoldBotGamePlayerOnLeave } from '../src/controllers/BotGameController.js';


const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server using Express
const httpServer = createServer(app);

// Create Socket.IO server and attach it to the HTTP server
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
    }
});

app.set('io', io); // Store the Socket.IO instance in the Express app

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
app.get('/api/friends', GetFriendsController);
app.get('/api/friends/requests', GetFriendRequestsController);
app.post('/api/friends/requests', SendFriendRequestController);
app.post('/api/friends/requests/:id/accept', AcceptFriendRequestController);
app.post('/api/friends/requests/:id/decline', DeclineFriendRequestController);
app.delete('/api/friends/:friendId', RemoveFriendController);
app.post('/api/tables', CreateTableController);
app.get('/api/tables', GetTablesController);
app.get('/api/tables/mine', GetMyTablesController);
app.post('/api/tables/join-code', JoinByCodeController);
app.post('/api/tables/:id/join', JoinTableController);
app.post('/api/tables/:id/leave', FoldBotGamePlayerOnLeave, LeaveTableController);
app.post('/api/tables/:id/spectate', SpectateTableController);
app.post('/api/tables/:id/stop-spectating', StopSpectatingController);
app.get('/api/tables/:id/chat', GetChatController);
app.get('/api/tables/:id', GetTableByIdController);
app.put('/api/tables/:id', UpdateTableController);
app.delete('/api/tables/:id', DeleteTableController);

app.post('/api/guests', CreateGuestController);
app.get('/api/guests/:id', GetGuestByIdController);

app.patch('/api/users/mute', PlayerMuteMusicController);
app.post('/api/complaints', FileComplaintController);
app.post('/api/auth/reset-password', SelfPasswordResetController);
app.post('/api/admin/reset-password', AdminPasswordResetController);
app.post('/api/games', CreatePokerGameController);
app.get('/api/games/:gameId/hand', GetPlayerHandController);
app.get('/api/players/me/chips', GetPlayerChipsController);
app.post('/api/bot-games', CreateBotGameController);
app.post('/api/bot-games/:gameId/action', BotGameActionController);
app.post('/api/bot-games/:gameId/draw', BotGameDrawController);
app.get('/api/bot-games/:gameId', GetBotGameController);
app.get('/api/tables/:id/bot-game', GetTableBotGameController);
io.use(async (socket, next) => {
    try {
        const cookie = socket.handshake.headers.cookie || '';

        const session = await auth.api.getSession({
            headers: new Headers({ cookie })
        });

        if (session?.user?.id) {
            const account = await Account.findOne({
                userId: session.user.id
            });

            if (!account) {
                return next(new Error('Account not found'));
            }

            socket.data.playerIdentity = {
                kind: 'user',
                refId: String(account._id)
            };

            return next();
        }

        // Guest authentication
        const guestId = socket.handshake.auth?.guestId;

        if (typeof guestId !== 'string' ||
            !mongoose.isValidObjectId(guestId)) {
            return next(new Error('Authentication required'));
        }

        const guest = await Guest.findById(guestId);

        if (!guest) {
            return next(new Error('Guest not found'));
        }

        socket.data.playerIdentity = {
            kind: 'guest',
            refId: String(guest._id)
        };

        next();

    } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('join-table-room', (tableId) => {
        socket.join(`table-${tableId}`);
        console.log(`Socket ${socket.id} joined room table-${tableId}`);
    });
    socket.on('leave-table-room', (tableId) => {
        socket.leave(`table-${tableId}`);
        console.log(`Socket ${socket.id} left room table-${tableId}`);
    });
    socket.on('table:set-ready', async ({ tableId, ready }, callback) => {
        try {
            if (!mongoose.isValidObjectId(tableId) || typeof ready !== 'boolean') {
                return callback?.({
                    ok: false,
                    error: 'Invalid request'
                });
            }

            const identity = socket.data.playerIdentity;

            if (!identity?.kind || !identity?.refId) {
                return callback?.({
                    ok: false,
                    error: 'Player authentication required'
                });
            }

            const table = await Table.findById(tableId);

            if (!table) {
                return callback?.({
                    ok: false,
                    error: 'Table not found'
                });
            }

            const seat = table.seats.find(player =>
                player.kind === identity.kind &&
                String(player.refId) === String(identity.refId)
            );

            if (!seat) {
                return callback?.({
                    ok: false,
                    error: 'You are not seated at this table'
                });
            }

            seat.ready = ready;
            await table.save();

            io.to(`table-${tableId}`).emit('table-updated', table);

            callback?.({ ok: true });

        } catch (error) {
            console.error('Error updating ready status:', error);

            callback?.({
                ok: false,
                error: 'Unable to update ready status'
            });
        }
    });
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
    // M3: table chat
    registerChatHandlers(io, socket);
});

async function startingServer() {
    try{
        await mongoClient.connect();
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.MONGODB_DB_NAME || 'poker'
        });
        
        console.log('Connected to MongoDB');

        httpServer.listen(PORT, () => {
            console.log(`Server and Socket.IO are running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}
startingServer();
