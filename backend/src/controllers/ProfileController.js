import { findFinishedHandsFor } from '../dao/GameHistoryDAO.js';
import Account from '../models/AccountModel.js';

const AVATARS = {
    'scarlet-ace': { kind: 'starter' },
    'midnight-club': { kind: 'starter' },
    'diamond-dealer': { kind: 'achievement', wins: 10 },
    'river-crown': { kind: 'achievement', hands: 100 },
    'gold-outlaw': { kind: 'purchase', price: 750 },
    'royal-phantom': { kind: 'purchase', price: 1500 },
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const DEFAULT_OWNED_AVATARS = ['scarlet-ace', 'midnight-club'];

async function getProfileStats(accountId) {
    const hands = await findFinishedHandsFor(accountId);
    const wins = hands.filter(hand =>
        (hand.engine?.winners ?? []).some(winner => String(winner.refId) === String(accountId))
    ).length;
    return { handsPlayed: hands.length, wins, losses: hands.length - wins };
}

function toProfileResponse(account, stats) {
    const ownedAvatars = Array.from(new Set([
        ...DEFAULT_OWNED_AVATARS,
        ...(account.ownedAvatars ?? []),
    ]));
    const profile = {
        id: String(account._id),
        displayName: account.displayName,
        username: account.username,
        email: account.email,
        role: account.role === 'admin' ? 'moderator' : 'player',
        status: 'active',
        chips: account.chipamount ?? 0,
        ...stats,
        avatarId: account.avatarId ?? 'scarlet-ace',
        ownedAvatars,
    };

    if (profile.avatarId === 'upload' && account.customAvatar) {
        profile.customAvatar = account.customAvatar;
    }
    return profile;
}

function sendError(res, error) {
    if (error?.name === 'PayloadTooLargeError' || error?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Choose an image smaller than 5 MB.' });
    }
    console.error('Profile request failed:', error);
    return res.status(500).json({ error: 'Profile request failed' });
}

export async function GetProfileController(req, res) {
    try {
        const account = await Account.findById(req.account._id).select('+customAvatar');
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        const stats = await getProfileStats(account._id);
        return res.status(200).json({ profile: toProfileResponse(account, stats) });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function EquipProfileAvatarController(req, res) {
    try {
        const { avatarId } = req.body ?? {};
        const avatar = Object.prototype.hasOwnProperty.call(AVATARS, avatarId)
            ? AVATARS[avatarId]
            : null;
        if (!avatar) {
            return res.status(400).json({ error: 'Invalid avatar selection' });
        }

        const ownedAvatars = new Set([
            ...DEFAULT_OWNED_AVATARS,
            ...(req.account.ownedAvatars ?? []),
        ]);
        if (avatar.kind === 'achievement') {
            const stats = await getProfileStats(req.account._id);
            const unlocked = avatar.wins ? stats.wins >= avatar.wins : stats.handsPlayed >= avatar.hands;
            if (!unlocked) {
                return res.status(403).json({ error: 'This avatar achievement is not unlocked yet.' });
            }
        } else if (avatar.kind === 'purchase' && !ownedAvatars.has(avatarId)) {
            const updatedAccount = await Account.findOneAndUpdate(
                {
                    _id: req.account._id,
                    chipamount: { $gte: avatar.price },
                    ownedAvatars: { $ne: avatarId },
                },
                {
                    $inc: { chipamount: -avatar.price },
                    $addToSet: { ownedAvatars: avatarId },
                    $set: { avatarId },
                    $unset: { customAvatar: 1 },
                },
                { new: true, runValidators: true },
            );
            if (!updatedAccount) {
                return res.status(409).json({ error: 'Not enough chips or avatar is already being purchased.' });
            }
            const stats = await getProfileStats(updatedAccount._id);
            return res.status(200).json({ profile: toProfileResponse(updatedAccount, stats) });
        }

        const updatedAccount = await Account.findOneAndUpdate(
            { _id: req.account._id },
            {
                $set: { avatarId },
                $addToSet: { ownedAvatars: avatarId },
                $unset: { customAvatar: 1 },
            },
            { new: true, runValidators: true },
        );
        if (!updatedAccount) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const stats = await getProfileStats(updatedAccount._id);
        return res.status(200).json({ profile: toProfileResponse(updatedAccount, stats) });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function UploadProfileAvatarController(req, res) {
    const image = req.body;
    const contentType = req.get('content-type');
    if (!Buffer.isBuffer(image) || image.length === 0 || image.length > MAX_AVATAR_BYTES) {
        return res.status(400).json({ error: 'Choose an image smaller than 5 MB.' });
    }

    const supportedTypes = {
        'image/jpeg': image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff,
        'image/png': image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        'image/webp': image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
    };
    if (!supportedTypes[contentType]) {
        return res.status(415).json({ error: 'Choose a valid JPEG, PNG, or WebP image.' });
    }

    try {
        const updatedAccount = await Account.findOneAndUpdate(
            { _id: req.account._id },
            {
                $set: {
                    avatarId: 'upload',
                    customAvatar: `data:${contentType};base64,${image.toString('base64')}`,
                },
            },
            { new: true, runValidators: true },
        );
        if (!updatedAccount) {
            return res.status(404).json({ error: 'Account not found' });
        }

        return res.status(200).json({ avatarId: 'upload' });
    } catch (error) {
        return sendError(res, error);
    }
}
