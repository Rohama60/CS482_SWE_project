import cors from 'cors';
import { SignUpController } from '../src/controllers/SignUpController.js';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { CreateTableController , GetTablesController, GetTableByIdController, DeleteTableController} from '../src/controllers/TableController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;



app.use(cors( { origin: 'http://localhost:5173' } ));
app.use(express.json());

app.post('/api/signup', (req,res,next) => {
    console.log("POST request received at /api/signup");
    next();
}, SignUpController);

app.post('/api/tables', CreateTableController);
app.get('/api/tables', GetTablesController);
app.get('/api/tables/:id', GetTableByIdController);
app.delete('/api/tables/:id', DeleteTableController);

async function startingServer() {
    try{
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
