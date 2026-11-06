import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// G2: As a Guest, I want to be able to create an account,
// so that I can save my money in my personalized account.

const mockSignUpEmail = jest.fn();
const mockFindGuestById = jest.fn();
const mockDeleteGuest = jest.fn();
const mockSetAccountChips = jest.fn();

// Fake Better Auth and the database so nothing real is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { signUpEmail: mockSignUpEmail } }
}));
jest.unstable_mockModule('../src/dao/GuestDAO.js', () => ({
    findGuestById: mockFindGuestById,
    deleteGuest: mockDeleteGuest,
    createGuest: jest.fn()
}));
jest.unstable_mockModule('../src/dao/AccountDAO.js', () => ({
    setAccountChips: mockSetAccountChips,
    createAccount: jest.fn(),
    findAccountByEmail: jest.fn(),
    findAccountByUsername: jest.fn()
}));

const { SignUpController, saveGuestChips } = await import('../src/controllers/SignUpController.js');

const GUEST_ID = '507f1f77bcf86cd799439022';
const NEW_USER = { id: 'auth-user-1', name: 'Preston', email: 'preston@example.com' };

function signUpReq(extra = {}) {
    return {
        headers: new Headers(),
        body: {
            name: 'Preston', username: 'PrestonA7', email: 'preston@example.com',
            password: 'password123', confirmPassword: 'password123', ...extra
        }
    };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSignUpEmail.mockResolvedValue({ response: { user: NEW_USER }, headers: new Headers() });
});

describe('Guest creates an account (G2)', () => {
    test('the guest keeps their chips on the new account', async () => {
        mockFindGuestById.mockResolvedValue({ id: GUEST_ID, displayName: 'Guest-1234', chipamount: 480 });
        const res = makeRes();

        await SignUpController(signUpReq({ guestId: GUEST_ID }), res);

        expect(mockSetAccountChips).toHaveBeenCalledWith('auth-user-1', 480);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ user: NEW_USER, savedChips: 480 });
    });

    test('the guest record is deleted after the chips move', async () => {
        mockFindGuestById.mockResolvedValue({ id: GUEST_ID, chipamount: 480 });

        await SignUpController(signUpReq({ guestId: GUEST_ID }), makeRes());

        expect(mockDeleteGuest).toHaveBeenCalledWith(GUEST_ID);
    });

    test('the guest id is not sent to Better Auth', async () => {
        mockFindGuestById.mockResolvedValue({ id: GUEST_ID, chipamount: 480 });

        await SignUpController(signUpReq({ guestId: GUEST_ID }), makeRes());

        expect(mockSignUpEmail.mock.calls[0][0].body).not.toHaveProperty('guestId');
    });

    test('a normal sign up (not a guest) works like before', async () => {
        const res = makeRes();

        await SignUpController(signUpReq(), res);

        expect(mockFindGuestById).not.toHaveBeenCalled();
        expect(mockSetAccountChips).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ user: NEW_USER });
    });

    test('an expired guest just gets a normal account', async () => {
        mockFindGuestById.mockResolvedValue(null);
        const res = makeRes();

        await SignUpController(signUpReq({ guestId: GUEST_ID }), res);

        expect(mockSetAccountChips).not.toHaveBeenCalled();
        expect(mockDeleteGuest).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ user: NEW_USER });
    });

    test('if moving the chips fails, the account is still created', async () => {
        mockFindGuestById.mockResolvedValue({ id: GUEST_ID, chipamount: 480 });
        mockSetAccountChips.mockRejectedValue(new Error('DB down'));
        const res = makeRes();

        await SignUpController(signUpReq({ guestId: GUEST_ID }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ user: NEW_USER });
        expect(mockDeleteGuest).not.toHaveBeenCalled();
    });

    test('if the sign up itself fails, the guest is left alone', async () => {
        mockSignUpEmail.mockRejectedValue(new Error('boom'));
        const res = makeRes();

        await SignUpController(signUpReq({ guestId: GUEST_ID }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(mockFindGuestById).not.toHaveBeenCalled();
        expect(mockDeleteGuest).not.toHaveBeenCalled();
    });
});

describe('saveGuestChips', () => {
    test('does nothing without a guest id', async () => {
        expect(await saveGuestChips(undefined, 'auth-user-1')).toBeNull();
        expect(mockFindGuestById).not.toHaveBeenCalled();
    });

    test('does nothing with a badly formatted guest id', async () => {
        expect(await saveGuestChips('not-an-id', 'auth-user-1')).toBeNull();
        expect(mockFindGuestById).not.toHaveBeenCalled();
    });

    test('does nothing if Better Auth sent back no user', async () => {
        expect(await saveGuestChips(GUEST_ID, undefined)).toBeNull();
        expect(mockFindGuestById).not.toHaveBeenCalled();
    });

    test('a guest with 0 chips still moves over with 0', async () => {
        mockFindGuestById.mockResolvedValue({ id: GUEST_ID, chipamount: 0 });
        expect(await saveGuestChips(GUEST_ID, 'auth-user-1')).toBe(0);
        expect(mockSetAccountChips).toHaveBeenCalledWith('auth-user-1', 0);
    });
});
