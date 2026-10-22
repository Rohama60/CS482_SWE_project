import { APIError } from 'better-auth/api';
import { auth } from '../Auth.js';


export async function SignUpController(req, res){
    console.log("1. Signup controller reached");
    const { name, email, username, password } = req.body;
    if(!name || !email || !username || !password){
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
                console.log("2. Calling Better Auth");

        const result = await auth.api.signUpEmail({
            body: { name, email, username, password },
            headers: req.headers,
            returnHeaders: true,
        });
        console.log("3. Better Auth finished");

        result.headers?.forEach((value, key) => res.setHeader(key, value));
        return res.status(200).json(result.response);
    } catch (error) {
        if (error instanceof APIError) {
            return res.status(error.statusCode).json({
                error: error.message,
            });
        }

        console.error('Sign up failed:', error);
        return res.status(500).json({ error: 'Unable to create account' });
    }
}