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

  test('returns not found when the profile account does not exist', async () => {
    mockSelect.mockResolvedValue(null);
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'missing-account' } }, res);

    expect(mockFindFinishedHandsFor).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
  });

  test('applies profile defaults and includes an uploaded avatar for administrators', async () => {
    mockSelect.mockResolvedValue({
      _id: 'admin-id',
      username: 'admin',
      role: 'admin',
      avatarId: 'upload',
      customAvatar: 'data:image/png;base64,abc',
    });
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'admin-id' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      profile: expect.objectContaining({
        id: 'admin-id',
        role: 'moderator',
        chips: 0,
        handsPlayed: 0,
        wins: 0,
        losses: 0,
        avatarId: 'upload',
        ownedAvatars: ['scarlet-ace', 'midnight-club'],
        customAvatar: 'data:image/png;base64,abc',
      }),
    });
  });

  test('uses the starter avatar when no avatar has been selected', async () => {
    mockSelect.mockResolvedValue({
      _id: 'account-id',
      username: 'player',
      role: 'player',
    });
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'account-id' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      profile: expect.objectContaining({ avatarId: 'scarlet-ace' }),
    });
  });

  test('treats hands without winner data as losses and omits a missing uploaded image', async () => {
    mockSelect.mockResolvedValue({
      _id: 'account-id',
      username: 'player',
      avatarId: 'upload',
    });
    mockFindFinishedHandsFor.mockResolvedValue([
      {},
      { engine: {} },
      { engine: { winners: null } },
    ]);
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'account-id' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      profile: expect.objectContaining({
        handsPlayed: 3,
        wins: 0,
        losses: 3,
        avatarId: 'upload',
      }),
    });
    expect(res.json.mock.calls[0][0].profile).not.toHaveProperty('customAvatar');
  });

  test('maps profile loading errors to a server error', async () => {
    const error = new Error('database unavailable');
    mockSelect.mockRejectedValue(error);
    const res = mockResponse();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await GetProfileController({ account: { _id: 'account-id' } }, res);

    expect(consoleError).toHaveBeenCalledWith('Profile request failed:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Profile request failed' });
    consoleError.mockRestore();
  });

  test('maps oversized profile requests to a payload-too-large response', async () => {
    mockSelect.mockRejectedValue(Object.assign(new Error('too large'), {
      type: 'entity.too.large',
    }));
    const res = mockResponse();

    await GetProfileController({ account: { _id: 'account-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'Choose an image smaller than 5 MB.' });
  });

  test('rejects unknown avatar identifiers', async () => {
    const res = mockResponse();

    await EquipProfileAvatarController({
      account: { _id: 'account-id' },
      body: { avatarId: 'not-an-avatar' },
    }, res);

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid avatar selection' });
  });

  test('rejects an avatar request with no body', async () => {
    const res = mockResponse();

    await EquipProfileAvatarController({ account: { _id: 'account-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid avatar selection' });
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

  test('equips an achievement avatar after the required number of hands', async () => {
    const account = {
      _id: 'account-id',
      username: 'player',
      role: 'player',
      chipamount: 100,
      avatarId: 'river-crown',
      ownedAvatars: ['river-crown'],
    };
    mockFindFinishedHandsFor.mockResolvedValue(
      Array.from({ length: 100 }, () => ({ engine: { winners: [] } })),
    );
    mockFindOneAndUpdate.mockResolvedValue(account);
    const res = mockResponse();

    await EquipProfileAvatarController({
      account: { _id: 'account-id' },
      body: { avatarId: 'river-crown' },
    }, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'account-id' },
      {
        $set: { avatarId: 'river-crown' },
        $addToSet: { ownedAvatars: 'river-crown' },
        $unset: { customAvatar: 1 },
      },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns a conflict when an avatar purchase cannot be completed', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);
    const res = mockResponse();

    await EquipProfileAvatarController({
      account: { _id: 'account-id', ownedAvatars: [] },
      body: { avatarId: 'gold-outlaw' },
    }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not enough chips or avatar is already being purchased.',
    });
  });

  test('equips an already-owned rare avatar without charging chips again', async () => {
    const account = {
      _id: 'account-id',
      username: 'player',
      role: 'player',
      chipamount: 100,
      avatarId: 'gold-outlaw',
      ownedAvatars: ['gold-outlaw'],
    };
    mockFindOneAndUpdate.mockResolvedValue(account);
    const res = mockResponse();

    await EquipProfileAvatarController({
      account: { _id: 'account-id', ownedAvatars: ['gold-outlaw'] },
      body: { avatarId: 'gold-outlaw' },
    }, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'account-id' },
      {
        $set: { avatarId: 'gold-outlaw' },
        $addToSet: { ownedAvatars: 'gold-outlaw' },
        $unset: { customAvatar: 1 },
      },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns not found when the account disappears during avatar equipment', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);
    const res = mockResponse();

    await EquipProfileAvatarController({
      account: { _id: 'account-id' },
      body: { avatarId: 'scarlet-ace' },
    }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
  });

  test('maps avatar equipment errors to a server error', async () => {
    const error = new Error('database unavailable');
    mockFindOneAndUpdate.mockRejectedValue(error);
    const res = mockResponse();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await EquipProfileAvatarController({
      account: { _id: 'account-id' },
      body: { avatarId: 'scarlet-ace' },
    }, res);

    expect(consoleError).toHaveBeenCalledWith('Profile request failed:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    consoleError.mockRestore();
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

  test.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/webp', Buffer.from('RIFF0000WEBP', 'ascii')],
  ])('accepts a valid %s custom avatar', async (contentType, image) => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'account-id' });
    const req = {
      account: { _id: 'account-id' },
      body: image,
      get: jest.fn().mockReturnValue(contentType),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'account-id' },
      {
        $set: {
          avatarId: 'upload',
          customAvatar: `data:${contentType};base64,${image.toString('base64')}`,
        },
      },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test.each([
    ['missing', undefined, 'image/png'],
    ['empty', Buffer.alloc(0), 'image/png'],
    ['too large', Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'],
  ])('rejects a %s custom avatar image', async (_label, image, contentType) => {
    const req = {
      account: { _id: 'account-id' },
      body: image,
      get: jest.fn().mockReturnValue(contentType),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Choose an image smaller than 5 MB.' });
  });

  test('rejects an unsupported custom avatar image type', async () => {
    const req = {
      account: { _id: 'account-id' },
      body: Buffer.from('not-an-image'),
      get: jest.fn().mockReturnValue('image/gif'),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ error: 'Choose a valid JPEG, PNG, or WebP image.' });
  });

  test('returns not found when the account disappears during avatar upload', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockFindOneAndUpdate.mockResolvedValue(null);
    const req = {
      account: { _id: 'account-id' },
      body: png,
      get: jest.fn().mockReturnValue('image/png'),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
  });

  test('maps oversized avatar upload errors to a payload-too-large response', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockFindOneAndUpdate.mockRejectedValue(Object.assign(new Error('too large'), {
      name: 'PayloadTooLargeError',
    }));
    const req = {
      account: { _id: 'account-id' },
      body: png,
      get: jest.fn().mockReturnValue('image/png'),
    };
    const res = mockResponse();

    await UploadProfileAvatarController(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'Choose an image smaller than 5 MB.' });
  });
});
