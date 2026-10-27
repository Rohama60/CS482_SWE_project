import { APIError } from 'better-auth/api';
import { auth } from '../Auth.js';


export async function SignUpController(req, res){
    const { name, email, username, password, confirmPassword } = req.body || {};
    if(!name || !email || !username || !password || !confirmPassword){
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if(password !== confirmPassword){
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    try {
        // 
        const result = await auth.api.signUpEmail({
            body: { name, email, username, password, confirmPassword },
            headers: req.headers,
            returnHeaders: true,
        });

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