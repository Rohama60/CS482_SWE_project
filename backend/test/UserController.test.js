import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindByIdAndUpdate = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockAccountFind = jest.fn();
const mockAccountFindById = jest.fn();
const mockIsValidObjectId = jest.fn();
const mockComplaintSave = jest.fn();
const mockHash = jest.fn();
const mockComplaint = jest.fn(() => ({ save: mockComplaintSave }));

jest.unstable_mockModule('../src/models/User.js', () => ({
  default: {
    findByIdAndUpdate: mockFindByIdAndUpdate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));
jest.unstable_mockModule('../src/models/Complaint.js', () => ({
  default: mockComplaint,
}));
jest.unstable_mockModule('bcrypt', () => ({
  default: { hash: mockHash },
}));

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
  default: {
    find: mockAccountFind,
    findById: mockAccountFindById,
  },
}));

jest.unstable_mockModule('mongoose', () => ({
  default: {
    isValidObjectId: mockIsValidObjectId,
  },
}));
const {  PlayerMuteMusicController,  FileComplaintController,  SelfPasswordResetController,AdminPasswordResetController,GetUsersController, GetCurrentUserController,  GetUserByIdController,
} = await import('../src/controllers/UserController.js');

describe('Controller Unit Tests', () => {

  // Helper mock for Express req, res objects
  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PlayerMuteMusicController', () => {
    test('should return 400 if required fields are missing', async () => {
      const req = { body: { userId: '123' } }; // missing musicMuted
      const res = mockResponse();

      await PlayerMuteMusicController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('should update music mute setting successfully', async () => {
      const req = { body: { userId: '123', musicMuted: true } };
      const res = mockResponse();

      mockFindByIdAndUpdate.mockResolvedValue({
        settings: { musicMuted: true }
      });

      await PlayerMuteMusicController(req, res);

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith('123', { "settings.musicMuted": true }, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, musicMuted: true });
    });

    test('should return 404 if user is not found', async () => {
      const req = { body: { userId: '999', musicMuted: false } };
      const res = mockResponse();

      mockFindByIdAndUpdate.mockResolvedValue(null);

      await PlayerMuteMusicController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
  });

  describe('FileComplaintController', () => {
    test('should return 400 if fields are missing', async () => {
      const req = { body: { reporterId: '123', reportedUsername: 'baduser' } }; // missing reason & details
      const res = mockResponse();

      await FileComplaintController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('should save and return success when complaint is valid', async () => {
      const req = { body: { reporterId: '123', reportedUsername: 'baduser', reason: 'Harassment', details: 'Spamming chat' } };
      const res = mockResponse();

      // Mock save method on the Complaint instance
      mockComplaintSave.mockResolvedValue(true);

      await FileComplaintController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Complaint submitted successfully.' });
    });
  });

  describe('SelfPasswordResetController', () => {
    test('should return 400 if email or newPassword is missing', async () => {
      const req = { body: { email: 'test@test.com' } };
      const res = mockResponse();

      await SelfPasswordResetController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('should hash password and update user successfully', async () => {
      const req = { body: { email: 'test@test.com', newPassword: 'newSecurePassword123' } };
      const res = mockResponse();

      mockHash.mockResolvedValue('hashedPassword123');
      mockFindOneAndUpdate.mockResolvedValue({ email: 'test@test.com' });

      await SelfPasswordResetController(req, res);

      expect(mockHash).toHaveBeenCalledWith('newSecurePassword123', 10);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ email: 'test@test.com' }, { password: 'hashedPassword123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Password updated successfully.' });
    });
  });

  describe('AdminPasswordResetController', () => {
    test('should return 400 if targetUserId or newPassword is missing', async () => {
      const req = { body: { newPassword: 'password123' } };
      const res = mockResponse();

      await AdminPasswordResetController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('should hash password and reset user password as admin', async () => {
      const req = { body: { targetUserId: 'user456', newPassword: 'tempPassword123' } };
      const res = mockResponse();

      mockHash.mockResolvedValue('hashedTempPass');
      mockFindByIdAndUpdate.mockResolvedValue({ _id: 'user456' });

      await AdminPasswordResetController(req, res);

      expect(mockHash).toHaveBeenCalledWith('tempPassword123', 10);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith('user456', { password: 'hashedTempPass' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Admin successfully reset user password.' });
    });

      // GET /api/users
      describe('GetUsersController', () => {
        test('should return all users successfully', async () => {
          const users = [
            {
              _id: '123',
              username: 'player1',
              displayName: 'Player One',
              email: 'player1@test.com',
              chipamount: 500,
              wins: 5,
              losses: 2,
              role: 'player',
            },
          ];

          const mockLimit = jest.fn().mockResolvedValue(users);
          const mockSort = jest.fn().mockReturnValue({
            limit: mockLimit,
          });

          mockAccountFind.mockReturnValue({
            sort: mockSort,
          });

          const req = { query: {} };
          const res = mockResponse();

          await GetUsersController(req, res);

          expect(mockAccountFind).toHaveBeenCalledWith({});
          expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
          expect(mockLimit).toHaveBeenCalledWith(100);
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith([
            expect.objectContaining({
              username: 'player1',
              chipamount: 500,
            }),
          ]);
        });

        test('should search users and sort by balance', async () => {
          const mockLimit = jest.fn().mockResolvedValue([]);
          const mockSort = jest.fn().mockReturnValue({
            limit: mockLimit,
          });

          mockAccountFind.mockReturnValue({
            sort: mockSort,
          });

          const req = {
            query: {
              search: 'player',
              sortBy: 'balance',
            },
          };
          const res = mockResponse();

          await GetUsersController(req, res);

          expect(mockAccountFind).toHaveBeenCalledWith({
            $or: [
              { username: { $regex: 'player', $options: 'i' } },
              { email: { $regex: 'player', $options: 'i' } },
              { displayName: { $regex: 'player', $options: 'i' } },
            ],
          });

          expect(mockSort).toHaveBeenCalledWith({
            chipamount: -1,
          });
          expect(res.status).toHaveBeenCalledWith(200);
        });

        test('should return 500 when fetching users fails', async () => {
          mockAccountFind.mockImplementation(() => {
            throw new Error('Database error');
          });

          const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

          try {
            const req = { query: {} };
            const res = mockResponse();

            await GetUsersController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
              error: 'Failed to fetch users',
            });
          } finally {
            consoleSpy.mockRestore();
          }
        });
      });

      // GET /api/users/me
      describe('GetCurrentUserController', () => {
        test('should return current authenticated user', async () => {
          const req = {
            account: {
              _id: '123',
              username: 'player1',
              displayName: 'Player One',
              email: 'player1@test.com',
              chipamount: 500,
              wins: 2,
              losses: 1,
              role: 'player',
            },
          };

          const res = mockResponse();

          await GetCurrentUserController(req, res);

          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith({
            user: expect.objectContaining({
              id: '123',
              username: 'player1',
              chipamount: 500,
            }),
          });
        });

        test('should return 500 if account is missing', async () => {
          const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

          try {
            const req = {};
            const res = mockResponse();

            await GetCurrentUserController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
              error: 'Failed to fetch current user',
            });
          } finally {
            consoleSpy.mockRestore();
          }
        });
      });

      // GET /api/users/:id
      describe('GetUserByIdController', () => {
        beforeEach(() => {
          mockIsValidObjectId.mockReturnValue(true);
        });

        test('should reject an invalid user ID', async () => {
          mockIsValidObjectId.mockReturnValue(false);

          const req = {
            params: { id: 'invalid' },
          };
          const res = mockResponse();

          await GetUserByIdController(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid user ID',
          });
        });

        test('should prevent players from accessing other profiles', async () => {
          const req = {
            params: { id: '456' },
            account: {
              _id: '123',
              role: 'player',
            },
          };
          const res = mockResponse();

          await GetUserByIdController(req, res);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            error: 'You may only view your own profile',
          });
        });

        test('should allow players to view their own profile', async () => {
          const req = {
            params: { id: '123' },
            account: {
              _id: '123',
              username: 'player1',
              role: 'player',
              chipamount: 500,
            },
          };
          const res = mockResponse();

          await GetUserByIdController(req, res);

          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith({
            user: expect.objectContaining({
              id: '123',
              username: 'player1',
            }),
          });

          expect(mockAccountFindById).not.toHaveBeenCalled();
        });

        test('should allow admins to view another profile', async () => {
          const requestedUser = {
            _id: '456',
            username: 'player2',
            chipamount: 1000,
            role: 'player',
          };

          mockAccountFindById.mockResolvedValue(requestedUser);

          const req = {
            params: { id: '456' },
            account: {
              _id: '123',
              role: 'admin',
            },
          };
          const res = mockResponse();

          await GetUserByIdController(req, res);

          expect(mockAccountFindById).toHaveBeenCalledWith('456');
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith({
            user: expect.objectContaining({
              id: '456',
              username: 'player2',
            }),
          });
        });

        test('should return 404 if user does not exist', async () => {
          mockAccountFindById.mockResolvedValue(null);

          const req = {
            params: { id: '456' },
            account: {
              _id: '123',
              role: 'admin',
            },
          };
          const res = mockResponse();

          await GetUserByIdController(req, res);

          expect(res.status).toHaveBeenCalledWith(404);
          expect(res.json).toHaveBeenCalledWith({
            error: 'User not found',
          });
        });

        test('should return 500 if database lookup fails', async () => {
          mockAccountFindById.mockRejectedValue(
            new Error('Database error')
          );

          const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

          try {
            const req = {
              params: { id: '456' },
              account: {
                _id: '123',
                role: 'admin',
              },
            };
            const res = mockResponse();

            await GetUserByIdController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
              error: 'Failed to fetch user',
            });
          } finally {
            consoleSpy.mockRestore();
          }
        });
      });

  });

});