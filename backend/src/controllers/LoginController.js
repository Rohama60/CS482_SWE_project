import { APIError } from 'better-auth/api';
import { auth } from '../Auth.js';

// Login: a member signs in with their email and password.
// Better Auth checks the password and sends back the session cookie.
export async function LoginController(req, res) {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Enter your email and password' });
    }

    try {
        const result = await auth.api.signInEmail({
            body: { email: email.trim().toLowerCase(), password },
            headers: req.headers,
            returnHeaders: true,
        });

        // Passes the session cookie on to the browser
        result.headers?.forEach((value, key) => res.setHeader(key, value));
        return res.status(200).json({ user: result.response?.user ?? null });
    } catch (error) {
        if (error instanceof APIError) {
            // Wrong email or password. Same message either way so nobody can tell which emails exist.
            if (error.statusCode === 401) {
                return res.status(401).json({ error: 'Incorrect email or password' });
            }
            return res.status(error.statusCode).json({ error: error.message });
        }

        console.error('Login failed:', error);
        return res.status(500).json({ error: 'Unable to log in' });
    }
}
