import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { toNodeHandler } from 'better-auth/node';
import { auth, mongoClient } from '../src/Auth.js';
import { CreateTableController , GetTablesController, GetTableByIdController, DeleteTableController} from '../src/controllers/TableController.js';

const app = express();
const PORT = process.env.PORT || 3000;



app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.all('/api/auth/{*splat}', toNodeHandler(auth));
app.use(express.json());


app.post('/api/tables', CreateTableController);
app.get('/api/tables', GetTablesController);
app.get('/api/tables/:id', GetTableByIdController);
app.delete('/api/tables/:id', DeleteTableController);

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
