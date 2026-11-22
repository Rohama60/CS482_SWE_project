import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockAccountUpdate = jest.fn();
const mockGuestUpdate = jest.fn();
const mockGetJoiningPlayer = jest.fn();

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
  default: { findOneAndUpdate: mockAccountUpdate },
}));
jest.unstable_mockModule('../src/models/GuestModel.js', () => ({
  default: { findOneAndUpdate: mockGuestUpdate },
}));
jest.unstable_mockModule('../src/controllers/JoinTableController.js', () => ({
  getJoiningPlayer: mockGetJoiningPlayer,
}));

const { ClaimAdRewardController } = await import('../src/controllers/AdRewardController.js');

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ClaimAdRewardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('awards the fixed quick reward and records its hourly cooldown', async () => {
    mockGetJoiningPlayer.mockResolvedValue({ kind: 'user', refId: 'account-id' });
    mockAccountUpdate.mockResolvedValue({ chipamount: 1000 });
    const res = mockResponse();

    await ClaimAdRewardController({ body: { adType: 'quick' } }, res);

    expect(mockAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'account-id',
        $or: expect.any(Array),
      }),
      expect.objectContaining({
        $inc: { chipamount: 500 },
        $set: { lastQuickAdAt: expect.any(Date) },
      }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ chipamount: 1000, reward: 500 });
  });

  test('applies the reward to the authenticated guest account', async () => {
    mockGetJoiningPlayer.mockResolvedValue({ kind: 'guest', refId: 'guest-id' });
    mockGuestUpdate.mockResolvedValue({ chipamount: 2000 });
    const res = mockResponse();

    await ClaimAdRewardController({ body: { adType: 'feature' } }, res);

    expect(mockGuestUpdate).toHaveBeenCalledWith(
      { _id: 'guest-id' },
      { $inc: { chipamount: 1500 } },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejects unknown rewards and unauthenticated players', async () => {
    const invalidResponse = mockResponse();
    await ClaimAdRewardController({ body: { adType: 'custom', amount: 999999 } }, invalidResponse);
    expect(invalidResponse.status).toHaveBeenCalledWith(400);

    mockGetJoiningPlayer.mockResolvedValue(null);
    const unauthenticatedResponse = mockResponse();
    await ClaimAdRewardController({ body: { adType: 'premium' } }, unauthenticatedResponse);
    expect(unauthenticatedResponse.status).toHaveBeenCalledWith(401);
    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockGuestUpdate).not.toHaveBeenCalled();
  });

  test('does not award quick chips again during the cooldown', async () => {
    mockGetJoiningPlayer.mockResolvedValue({ kind: 'user', refId: 'account-id' });
    mockAccountUpdate.mockResolvedValue(null);
    const res = mockResponse();

    await ClaimAdRewardController({ body: { adType: 'quick' } }, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(mockAccountUpdate).toHaveBeenCalledTimes(1);
  });
});
