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

  test('uses the username and zero defaults when optional ranking fields are missing', async () => {
    mockLean.mockResolvedValue([{
      userId: 'legacy-user-id',
      username: 'old-player',
    }]);
    const res = mockResponse();

    await GetLeaderboardController({}, res);

    expect(res.json).toHaveBeenCalledWith({
      players: [{
        id: 'legacy-user-id',
        name: 'old-player',
        chips: 0,
        wins: 0,
        handsPlayed: 0,
      }],
    });
  });

  test('returns a server error when the leaderboard query fails', async () => {
    const error = new Error('database unavailable');
    mockLean.mockRejectedValue(error);
    const res = mockResponse();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await GetLeaderboardController({}, res);

    expect(consoleError).toHaveBeenCalledWith('Error fetching leaderboard:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load leaderboard' });
    consoleError.mockRestore();
  });
});
