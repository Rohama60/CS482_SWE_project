import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { APIError } from 'better-auth/api';

const mockSignInEmail = jest.fn();

// Fake Better Auth so no database is used
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { signInEmail: mockSignInEmail } }
}));

const { LoginController } = await import('../src/controllers/LoginController.js');

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
}

function loginReq(body) {
    return { headers: new Headers(), body };
}

describe('Login Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('logs in with the right email and password and sends the session cookie', async () => {
        const headers = new Headers({ 'set-cookie': 'session=abc' });
        mockSignInEmail.mockResolvedValue({
            response: { user: { id: 'u1', name: 'Preston', email: 'preston@example.com' } },
            headers
        });
        const res = makeRes();

        await LoginController(loginReq({ email: 'preston@example.com', password: 'password123' }), res);

        expect(mockSignInEmail).toHaveBeenCalledWith(expect.objectContaining({
            body: { email: 'preston@example.com', password: 'password123' },
            returnHeaders: true
        }));
        expect(res.setHeader).toHaveBeenCalledWith('set-cookie', 'session=abc');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            user: { id: 'u1', name: 'Preston', email: 'preston@example.com' }
        });
    });

    test('ignores extra spaces and capital letters in the email', async () => {
        mockSignInEmail.mockResolvedValue({ response: { user: { id: 'u1' } }, headers: new Headers() });
        const res = makeRes();

        await LoginController(loginReq({ email: '  Preston@Example.COM ', password: 'password123' }), res);

        expect(mockSignInEmail.mock.calls[0][0].body.email).toBe('preston@example.com');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('works when Better Auth sends no headers or user back', async () => {
        mockSignInEmail.mockResolvedValue({});
        const res = makeRes();

        await LoginController(loginReq({ email: 'a@b.com', password: 'pw' }), res);

        expect(res.setHeader).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ user: null });
    });

    test('missing email returns 400', async () => {
        const res = makeRes();
        await LoginController(loginReq({ password: 'password123' }), res);
        expect(mockSignInEmail).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('missing password returns 400', async () => {
        const res = makeRes();
        await LoginController(loginReq({ email: 'a@b.com' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('no body at all returns 400', async () => {
        const res = makeRes();
        await LoginController({ headers: new Headers() }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('wrong email or password returns 401 with a general message', async () => {
        mockSignInEmail.mockRejectedValue(new APIError('UNAUTHORIZED', { message: 'Invalid email or password' }));
        const res = makeRes();

        await LoginController(loginReq({ email: 'a@b.com', password: 'wrong' }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect email or password' });
    });

    test('other Better Auth errors pass their status and message through', async () => {
        mockSignInEmail.mockRejectedValue(new APIError('FORBIDDEN', { message: 'Email not verified' }));
        const res = makeRes();

        await LoginController(loginReq({ email: 'a@b.com', password: 'pw' }), res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Email not verified' });
    });

    test('an unexpected error returns 500', async () => {
        mockSignInEmail.mockRejectedValue(new Error('DB down'));
        const res = makeRes();

        await LoginController(loginReq({ email: 'a@b.com', password: 'pw' }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unable to log in' });
    });
});
