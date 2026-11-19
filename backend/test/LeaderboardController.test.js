import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockLean = jest.fn();
const mockLimit = jest.fn(() => ({ lean: mockLean }));
const mockSort = jest.fn(() => ({ limit: mockLimit }));
const mockSelect = jest.fn(() => ({ sort: mockSort }));
const mockFind = jest.fn(() => ({ select: mockSelect }));

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
  default: { find: mockFind },
}));

const { GetLeaderboardController } = await import('../src/controllers/LeaderboardController.js');

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('GetLeaderboardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only public ranking fields for the top 100 players', async () => {
    mockLean.mockResolvedValue([{
      userId: 'auth-user-id',
      username: 'cardshark',
      displayName: 'Card Shark',
      chipamount: 850,
      wins: 8,
      losses: 2,
    }]);
    const res = mockResponse();

    await GetLeaderboardController({}, res);

    expect(mockFind).toHaveBeenCalledWith({ role: 'player' });
    expect(mockLimit).toHaveBeenCalledWith(100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      players: [{
        id: 'auth-user-id',
        name: 'Card Shark',
        chips: 850,
        wins: 8,
        handsPlayed: 10,
      }],
    });
  });
});
