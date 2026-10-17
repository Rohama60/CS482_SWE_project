import cors from 'cors';
import 'dotenv/config';
import { SignUpController } from '../src/controllers/SignUpController.js';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors( { origin: 'http://localhost:5173' } ));
app.use(express.json());

app.post('/api/signup', (req,res,next) => {
    console.log("POST request received at /api/signup");
    next();
}, SignUpController);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

