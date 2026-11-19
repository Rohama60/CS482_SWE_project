'use client'

import { useEffect, useState } from 'react'

export type ProfileUser = {
  id: string | number
  displayName?: string
  username?: string
  email?: string
  role: 'player' | 'moderator'
  status?: 'active' | 'suspended' | 'banned'
  chips?: number
  handsPlayed?: number
  wins?: number
}

type AvatarID = 'scarlet-ace' | 'midnight-club' | 'diamond-dealer' | 'river-crown' | 'gold-outlaw' | 'royal-phantom'
type AvatarTier = 'Starter' | 'Achievement' | 'Rare'
const AVATAR_IDS: AvatarID[] = ['scarlet-ace', 'midnight-club', 'diamond-dealer', 'river-crown', 'gold-outlaw', 'royal-phantom']

type AvatarOption = {
  id: AvatarID
  name: string
  tier: AvatarTier
  description: string
  accent: string
  glow: string
  price?: number
  unlock?: { label: string; complete: boolean }
}

function AvatarMark({ id, label }: { id: AvatarID; label: string }) {
  const palettes: Record<AvatarID, { from: string; to: string; ink: string }> = {
    'scarlet-ace': { from: '#671313', to: '#23090b', ink: '#f0a097' },
    'midnight-club': { from: '#262936', to: '#0c0e13', ink: '#d5d8e4' },
    'diamond-dealer': { from: '#6b1824', to: '#1e0b10', ink: '#ffb6c0' },
    'river-crown': { from: '#553712', to: '#171006', ink: '#f2cc7a' },
    'gold-outlaw': { from: '#775317', to: '#1f1606', ink: '#ffd978' },
    'royal-phantom': { from: '#40125f', to: '#110719', ink: '#d8a7ff' },
  }
  const palette = palettes[id]

  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={label} className="h-full w-full">
      <defs>
        <linearGradient id={`${id}-ground`} x1="14" y1="10" x2="82" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="22" fill={`url(#${id}-ground)`} />
      <circle cx="48" cy="48" r="34" fill="none" stroke={palette.ink} strokeOpacity=".18" strokeWidth="2" />
      {id === 'scarlet-ace' && (
        <path d="M48 18C43 29 26 36 26 50c0 9 7 15 16 12-1 7-4 11-8 15h28c-4-4-7-8-8-15 9 3 16-3 16-12 0-14-17-21-22-32Z" fill={palette.ink} />
      )}
      {id === 'midnight-club' && (
        <path d="M48 24a12 12 0 0 0-8 21 12 12 0 1 0 2 20c-1 6-4 10-8 14h28c-4-4-7-8-8-14a12 12 0 1 0 2-20 12 12 0 0 0-8-21Z" fill={palette.ink} />
      )}
      {id === 'diamond-dealer' && (
        <>
          <path d="m48 16 25 32-25 32-25-32 25-32Z" fill={palette.ink} />
          <path d="M48 27 37 48l11 21 11-21-11-21Z" fill={palette.to} opacity=".55" />
        </>
      )}
      {id === 'river-crown' && (
        <>
          <path d="m20 35 16 11 12-25 12 25 16-11-7 38H27l-7-38Z" fill={palette.ink} />
          <path d="M31 61h34" stroke={palette.to} strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {id === 'gold-outlaw' && (
        <>
          <path d="M23 38c8-4 14-13 17-22h16c3 9 9 18 17 22l-8 8H31l-8-8Z" fill={palette.ink} />
          <path d="M16 49c18 8 46 8 64 0l-5 13c-17 5-37 5-54 0l-5-13Z" fill={palette.ink} />
          <path d="M31 47h34" stroke={palette.to} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {id === 'royal-phantom' && (
        <>
          <path d="M48 15c18 7 28 24 25 48L61 78l-8-10-5 12-5-12-8 10-12-15c-3-24 7-41 25-48Z" fill={palette.ink} />
          <path d="M34 47c9-9 19-9 28 0l-5 10-9-4-9 4-5-10Z" fill={palette.to} opacity=".75" />
        </>
      )}
    </svg>
  )
}

export default function ProfileTab({
  user,
  onBack,
  onLogout,
}: {
  user: ProfileUser
  onBack: () => void
  onLogout: () => void
}) {
  const [profile, setProfile] = useState(user)
  const handsPlayed = profile.handsPlayed ?? 0
  const wins = profile.wins ?? 0
  const losses = Math.max(handsPlayed - wins, 0)
  const name = profile.displayName ?? profile.username ?? 'Royal Draw player'
  const [activeSection, setActiveSection] = useState<'overview' | 'avatars'>('overview')
  const [equippedAvatar, setEquippedAvatar] = useState<AvatarID | 'upload'>('scarlet-ace')
  const [ownedAvatars, setOwnedAvatars] = useState<Set<AvatarID>>(new Set(['scarlet-ace', 'midnight-club']))
  const [chipBalance, setChipBalance] = useState(profile.chips ?? 0)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [notice, setNotice] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)

  const avatars: AvatarOption[] = [
    { id: 'scarlet-ace', name: 'Scarlet Ace', tier: 'Starter', description: 'The house classic.', accent: '#c0392b', glow: 'rgba(192,57,43,.26)' },
    { id: 'midnight-club', name: 'Midnight Club', tier: 'Starter', description: 'Quiet confidence.', accent: '#9da4ba', glow: 'rgba(157,164,186,.18)' },
    { id: 'diamond-dealer', name: 'Diamond Dealer', tier: 'Achievement', description: 'Win ten hands.', accent: '#ff8fa3', glow: 'rgba(255,143,163,.22)', unlock: { label: `${Math.min(wins, 10)}/10 wins`, complete: wins >= 10 } },
    { id: 'river-crown', name: 'River Crown', tier: 'Achievement', description: 'Play one hundred hands.', accent: '#e4b85f', glow: 'rgba(228,184,95,.22)', unlock: { label: `${Math.min(handsPlayed, 100)}/100 hands`, complete: handsPlayed >= 100 } },
    { id: 'gold-outlaw', name: 'Gold Outlaw', tier: 'Rare', description: 'Limited vault issue.', accent: '#f4c75b', glow: 'rgba(244,199,91,.3)', price: 750 },
    { id: 'royal-phantom', name: 'Royal Phantom', tier: 'Rare', description: 'The rarest seat at the table.', accent: '#c47aff', glow: 'rgba(196,122,255,.28)', price: 1500 },
  ]

  const equippedOption = avatars.find(avatar => avatar.id === equippedAvatar)
  const winRate = handsPlayed ? Math.round((wins / handsPlayed) * 100) : 0

  useEffect(() => {
    const controller = new AbortController()
    async function loadProfile() {
      setProfileLoading(true)
      setProfileError('')
      try {
        const response = await fetch('/api/users/me/profile', {
          credentials: 'include',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null) as {
          error?: string
          profile?: ProfileUser & {
            avatarId?: AvatarID | 'upload'
            ownedAvatars?: string[]
            customAvatar?: string
          }
        } | null
        if (!response.ok || !data?.profile) {
          throw new Error(data?.error ?? 'Could not load your profile.')
        }

        const loadedProfile = data.profile
        setProfile(loadedProfile)
        setChipBalance(loadedProfile.chips ?? 0)
        if (loadedProfile.avatarId && (loadedProfile.avatarId === 'upload' || AVATAR_IDS.includes(loadedProfile.avatarId))) {
          setEquippedAvatar(loadedProfile.avatarId)
        }
        setOwnedAvatars(new Set([
          'scarlet-ace',
          'midnight-club',
          ...(loadedProfile.ownedAvatars ?? []).filter((id): id is AvatarID => AVATAR_IDS.includes(id as AvatarID)),
        ]))
        setAvatarPreview(loadedProfile.customAvatar ?? '')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setProfileError(error instanceof Error ? error.message : 'Could not load your profile.')
        }
      } finally {
        if (!controller.signal.aborted) setProfileLoading(false)
      }
    }

    void loadProfile()
    return () => controller.abort()
  }, [user.id])

  function applyProfileData(loadedProfile: ProfileUser & {
    avatarId?: AvatarID | 'upload'
    ownedAvatars?: string[]
    customAvatar?: string
  }) {
    setProfile(loadedProfile)
    setChipBalance(loadedProfile.chips ?? 0)
    if (loadedProfile.avatarId && (loadedProfile.avatarId === 'upload' || AVATAR_IDS.includes(loadedProfile.avatarId))) {
      setEquippedAvatar(loadedProfile.avatarId)
    }
    setOwnedAvatars(new Set([
      'scarlet-ace',
      'midnight-club',
      ...(loadedProfile.ownedAvatars ?? []).filter((id): id is AvatarID => AVATAR_IDS.includes(id as AvatarID)),
    ]))
    setAvatarPreview(loadedProfile.customAvatar ?? '')
  }

  async function chooseAvatar(avatar: AvatarOption) {
    setNotice('')
    if (!ownedAvatars.has(avatar.id) && avatar.unlock && !avatar.unlock.complete) {
      setNotice(`${avatar.name} unlocks after ${avatar.description.toLowerCase()}`)
      return
    }
    if (!ownedAvatars.has(avatar.id) && avatar.price && chipBalance < avatar.price) {
      setNotice(`You need ${avatar.price - chipBalance} more chips to unlock ${avatar.name}.`)
      return
    }

    setIsSavingAvatar(true)
    try {
      const response = await fetch('/api/users/me/profile/avatar', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: avatar.id }),
      })
      const data = await response.json().catch(() => null) as {
        error?: string
        profile?: ProfileUser & {
          avatarId?: AvatarID | 'upload'
          ownedAvatars?: string[]
          customAvatar?: string
        }
      } | null
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? 'Could not update your avatar.')
      }
      applyProfileData(data.profile)
      setNotice(`${avatar.name} equipped.`)
      setActiveSection('overview')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update your avatar.')
    } finally {
      setIsSavingAvatar(false)
    }
  }

  async function previewUpload(file: File | undefined) {
    setUploadError('')
    setNotice('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Choose an image smaller than 5 MB.')
      return
    }

    setIsSavingAvatar(true)
    try {
      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('The selected image could not be opened.'))
        reader.readAsDataURL(file)
      })
      const response = await fetch('/api/users/me/profile/avatar', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const data = await response.json().catch(() => null) as { error?: string; avatarId?: string } | null
      if (!response.ok || data?.avatarId !== 'upload') {
        throw new Error(data?.error ?? 'Could not upload your avatar.')
      }
      setAvatarPreview(preview)
      setEquippedAvatar('upload')
      setNotice('Custom avatar uploaded and equipped.')
      setActiveSection('overview')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload your avatar.')
    } finally {
      setIsSavingAvatar(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#0a0a0b' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 72% 48% at 50% 0%, rgba(90,10,10,.5), transparent 72%)' }} />
      <div className="absolute left-0 right-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />

      <header className="relative z-20 border-b px-5 py-4 sm:px-8" style={{ background: 'rgba(10,10,11,.88)', borderColor: '#22242c', backdropFilter: 'blur(14px)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm font-medium" style={{ background: 'transparent', border: 'none', color: '#e8e4dc', opacity: .55 }}>
            <span aria-hidden="true">←</span> Back
          </button>
          <div className="flex items-center gap-2.5">
            <span style={{ color: '#c0392b' }}>♠</span>
            <span className="text-sm font-semibold uppercase tracking-[.2em]" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Royal Draw</span>
          </div>
          <button type="button" onClick={onLogout} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}>
            Sign out
          </button>
        </div>
      </header>

      <main className="relative z-12 mx-auto w-full max-w-8xl px-6 py-10 sm:px-10">
        <section className="overflow-hidden rounded-2xl" style={{ background: '#14161b', border: '1px solid #292c35' }}>
          <div className="relative h-32 overflow-hidden" style={{ background: 'linear-gradient(120deg, #6b1010, #2b0a0b 58%, #15171d)' }}>
            <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full" style={{ border: '38px solid rgba(232,228,220,.035)' }} />
            <div className="absolute bottom-5 left-6 text-xs font-semibold uppercase tracking-[.28em] sm:left-8" style={{ color: '#f0a097' }}>Player identity</div>
          </div>

          <div className="px-5 pb-7 sm:px-8">
            <div className="-mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full shadow-xl" style={{ border: '4px solid #14161b', background: '#1c1e25' }}>
                  {equippedAvatar === 'upload' && avatarPreview ? (
                    <img src={avatarPreview} alt={`${name} avatar`} className="h-full w-full object-cover" />
                  ) : (
                    <AvatarMark
                      id={equippedAvatar === 'upload' ? 'scarlet-ace' : equippedAvatar}
                      label={equippedOption?.name ?? 'Scarlet Ace'}
                    />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest capitalize" style={{ color: '#f0a097' }}>{profile.role} account</p>
                  <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{name}</h1>
                  <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: .38 }}>
                    {equippedAvatar === 'upload' ? 'Custom avatar' : `${equippedOption?.name} · ${equippedOption?.tier}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('avatars')}
                      disabled={profileLoading || Boolean(profileError)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: '#1c1e25', border: '1px solid #3a3d49', color: '#e8e4dc', opacity: profileLoading || profileError ? .5 : 1 }}
                    >
                      Change avatar
                    </button>
                    <label
                      htmlFor="profile-avatar"
                      className={`${profileLoading || profileError || isSavingAvatar ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} rounded-lg px-3 py-1.5 text-xs font-semibold`}
                      style={{ background: 'rgba(192,57,43,.12)', border: '1px solid rgba(192,57,43,.38)', color: '#f0a097' }}
                    >
                      Upload image
                    </label>
                    <input
                      id="profile-avatar"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={profileLoading || Boolean(profileError) || isSavingAvatar}
                      onChange={event => previewUpload(event.target.files?.[0])}
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    />
                  </div>
                  {uploadError && <p role="alert" className="mt-2 text-xs" style={{ color: '#f0a097' }}>{uploadError}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#111318', border: '1px solid #292c35' }}>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: .4 }}>Available chips</span>
                <strong className="text-lg" style={{ color: '#f0a097', fontFamily: 'var(--font-display)' }}>{chipBalance.toLocaleString()}</strong>
              </div>
            </div>

            {profileError && (
              <p role="alert" className="mt-4 rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(192,57,43,.1)', border: '1px solid rgba(192,57,43,.28)', color: '#f0a097' }}>
                {profileError}
              </p>
            )}

            {profileLoading && <p role="status" className="mt-4 text-xs" style={{ color: '#e8e4dc', opacity: .5 }}>Loading profile…</p>}

            {activeSection === 'overview' ? (
              <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_.42fr]">
                <div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Wins', wins],
                      ['Losses', losses],
                      ['Hands', handsPlayed],
                      ['Win rate', handsPlayed ? `${winRate}%` : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl p-4" style={{ background: '#111318', border: '1px solid #292c35' }}>
                        <p className="text-xs" style={{ color: '#e8e4dc', opacity: .38 }}>{label}</p>
                        <p className="mt-2 text-2xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl p-5" style={{ background: '#111318', border: '1px solid #292c35' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>Road to Diamond Dealer</p>
                        <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: .38 }}>Win ten hands to unlock the achievement avatar.</p>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: '#f0a097' }}>{Math.min(wins, 10)}/10</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: '#242731' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min((wins / 10) * 100, 100)}%`, background: 'linear-gradient(90deg, #8b1a1a, #e05c4e)' }} />
                    </div>
                  </div>
                </div>
                <aside className="rounded-xl p-5" style={{ background: '#111318', border: '1px solid #292c35' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Account</p>
                  <dl className="mt-4 space-y-4">
                    {[
                      ['Username', profile.username ?? 'Not set'],
                      ['Email', profile.email ?? 'Not set'],
                      ['Status', profile.status ?? 'active'],
                      ['Access', profile.role],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs" style={{ color: '#e8e4dc', opacity: .32 }}>{label}</dt>
                        <dd className="mt-1 break-all text-sm capitalize" style={{ color: label === 'Status' ? '#86efac' : '#e8e4dc' }}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              </div>
            ) : (
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(6px)' }}>
                <div role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title" className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-5" style={{ background: '#14161b', border: '1px solid #3a2528', boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Avatar vault</p>
                    <h2 id="avatar-picker-title" className="mt-1 text-xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Choose a small avatar</h2>
                    <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: .35 }}>Pick one for the circle beside your name.</p>
                  </div>
                  <button type="button" onClick={() => setActiveSection('overview')} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}>
                    Close
                  </button>
                </div>

                {notice && (
                  <div role="status" className="mt-4 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(192,57,43,.1)', border: '1px solid rgba(192,57,43,.28)', color: '#f0a097' }}>
                    {notice}
                  </div>
                )}

                <div className="mt-5 space-y-2">
                  {avatars.map(avatar => {
                    const owned = ownedAvatars.has(avatar.id) || avatar.unlock?.complete
                    const equipped = equippedAvatar === avatar.id
                    const locked = Boolean(avatar.unlock && !avatar.unlock.complete)
                    return (
                      <article
                        key={avatar.id}
                        className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center"
                        style={{
                          background: equipped ? avatar.glow : '#111318',
                          border: `1px solid ${equipped ? avatar.accent : '#292c35'}`,
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full"><AvatarMark id={avatar.id} label={avatar.name} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold" style={{ color: '#e8e4dc' }}>{avatar.name}</p>
                              <span className="rounded-full px-2 py-1 text-[.6rem] font-bold uppercase tracking-wider" style={{ background: avatar.glow, color: avatar.accent }}>{avatar.tier}</span>
                            </div>
                            <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: .36 }}>{avatar.description}</p>
                            {avatar.unlock && <p className="mt-2 text-[.68rem] font-semibold" style={{ color: avatar.unlock.complete ? '#86efac' : '#e8e4dc', opacity: avatar.unlock.complete ? 1 : .48 }}>{avatar.unlock.label}</p>}
                            {avatar.price && !owned && <p className="mt-2 text-xs font-semibold" style={{ color: avatar.accent }}>{avatar.price.toLocaleString()} chips</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => chooseAvatar(avatar)}
                          disabled={equipped || profileLoading || Boolean(profileError) || isSavingAvatar}
                          className="w-full shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-55 sm:w-auto"
                          style={{
                            background: equipped ? '#252832' : owned ? '#1c1e25' : locked ? '#17191f' : `linear-gradient(135deg, ${avatar.accent}, #6b1010)`,
                            border: '1px solid #343743',
                            color: equipped || owned || locked ? '#e8e4dc' : '#0a0a0b',
                          }}
                        >
                          {isSavingAvatar ? 'Saving…' : equipped ? 'Equipped' : owned ? 'Equip avatar' : locked ? 'Locked' : `Buy for ${avatar.price?.toLocaleString()} chips`}
                        </button>
                      </article>
                    )
                  })}
                </div>

                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
