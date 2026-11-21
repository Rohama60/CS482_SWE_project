
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockGetSession = jest.fn();
const mockFindOne = jest.fn();

// Mock better-auth session
jest.unstable_mockModule('../src/Auth.js', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Mock MongoDB Account model
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
  default: {
    findOne: mockFindOne,
  },
}));

const {
  getAccountFromRequest,
  requireAccount,
} = await import('../src/middleware/accountAuth.js');

// Fake Express response
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Test the helper function
describe('getAccountFromRequest', () => {

  test('returns null if no session exists', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await getAccountFromRequest({
      headers: {},
    });

    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  test('returns null if session does not contain user ID', async () => {
    mockGetSession.mockResolvedValue({
      user: {},
    });

    const result = await getAccountFromRequest({
      headers: {},
    });

    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  test('returns user account when session is valid', async () => {
    const account = {
      _id: 'account123',
      userId: 'user123',
      displayName: 'Player One',
    };

    mockGetSession.mockResolvedValue({
      user: { id: 'user123' },
    });

    mockFindOne.mockResolvedValue(account);

    const result = await getAccountFromRequest({
      headers: {
        cookie: 'session=test',
      },
    });

    expect(mockFindOne).toHaveBeenCalledWith({
      userId: 'user123',
    });

    expect(result).toEqual(account);

    // Verify request headers are passed to auth
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });
});

// Test Express authentication middleware
describe('requireAccount', () => {

  test('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    await requireAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when user is authenticated', async () => {
    const account = {
      _id: 'account123',
      userId: 'user123',
    };

    mockGetSession.mockResolvedValue({
      user: { id: 'user123' },
    });

    mockFindOne.mockResolvedValue(account);

    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    await requireAccount(req, res, next);

    expect(req.account).toEqual(account);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when account is not found in database', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user123' },
    });

    mockFindOne.mockResolvedValue(null);

    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    await requireAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when authentication service fails', async () => {
    mockGetSession.mockRejectedValue(
      new Error('Authentication service unavailable')
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const req = { headers: {} };
      const res = mockResponse();
      const next = jest.fn();

      await requireAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
      });

      expect(next).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

});
