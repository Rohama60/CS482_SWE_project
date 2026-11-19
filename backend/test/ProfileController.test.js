import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindOneAndUpdate = jest.fn();
const mockSelect = jest.fn();
const mockFindById = jest.fn(() => ({ select: mockSelect }));
const mockFindFinishedHandsFor = jest.fn();

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
  default: {
    findOneAndUpdate: mockFindOneAndUpdate,
    findById: mockFindById,
  },
}));
jest.unstable_mockModule('../src/dao/GameHistoryDAO.js', () => ({
  findFinishedHandsFor: mockFindFinishedHandsFor,
}));

const { EquipProfileAvatarController, GetProfileController, UploadProfileAvatarController } =
  await import('../src/controllers/ProfileController.js');

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ProfileController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFinishedHandsFor.mockResolvedValue([]);
    mockFindById.mockReturnValue({ select: mockSelect });
  });

  test('atomically charges chips and equips an avatar purchase', async () => {
    mockFindOneAndUpdate.mockResolvedValue({
      _id: 'account-id',
      username: 'player',
      email: 'player@example.com',
      role: 'player',
      chipamount: 250,
      avatarId: 'gold-outlaw',
      ownedAvatars: ['scarlet-ace', 'midnight-club', 'gold-outlaw'],
    });

    const req = {
      account: { _id: 'account-id', ownedAvatars: ['scarlet-ace', 'midnight-club'] },
      body: { avatarId: 'gold-outlaw' },
    };
    const res = mockResponse();

    await EquipProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'account-id',
        chipamount: { $gte: 750 },
        ownedAvatars: { $ne: 'gold-outlaw' },
      },
      {
        $inc: { chipamount: -750 },
        $addToSet: { ownedAvatars: 'gold-outlaw' },
        $set: { avatarId: 'gold-outlaw' },
        $unset: { customAvatar: 1 },
      },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('loads profile details and derives stats from finished hands', async () => {
    mockSelect.mockResolvedValue({
      _id: 'account-id',
      username: 'player',
      displayName: 'Player One',
      email: 'player@example.com',
      role: 'player',
      chipamount: 900,
      avatarId: 'midnight-club',
      ownedAvatars: ['midnight-club'],
    });
    mockFindFinishedHandsFor.mockResolvedValue([
      { engine: { winners: [{ refId: 'account-id' }] } },
      { engine: { winners: [{ refId: 'other-account' }] } },
    ]);
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'account-id' } }, res);

    expect(mockSelect).toHaveBeenCalledWith('+customAvatar');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      profile: expect.objectContaining({
        id: 'account-id',
        chips: 900,
        handsPlayed: 2,
        wins: 1,
        losses: 1,
        avatarId: 'midnight-club',
      }),
    });
  });

  test('rejects locked achievement avatars', async () => {
    const req = {
      account: { _id: 'account-id', ownedAvatars: ['scarlet-ace', 'midnight-club'] },
      body: { avatarId: 'diamond-dealer' },
    };
    const res = mockResponse();

    await EquipProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('persists valid custom avatar uploads', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'account-id' });
    const req = {
      account: { _id: 'account-id' },
      body: png,
      get: jest.fn().mockReturnValue('image/png'),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'account-id' },
      { $set: { avatarId: 'upload', customAvatar: `data:image/png;base64,${png.toString('base64')}` } },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ avatarId: 'upload' });
  });
});
