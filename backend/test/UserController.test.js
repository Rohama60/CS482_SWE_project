import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindByIdAndUpdate = jest.fn();
const mockFindOneAndUpdate = jest.fn();
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

const { PlayerMuteMusicController, FileComplaintController, SelfPasswordResetController, AdminPasswordResetController } =
  await import('../src/controllers/UserController.js');

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
  });

});