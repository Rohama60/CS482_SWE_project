import { useState } from 'react';

export function AudioSettings({ userId }: { userId: string }) {
  const [isMuted, setIsMuted] = useState(false);

  async function toggleMute() {
    const nextState = !isMuted;
    setIsMuted(nextState);

    try {
      await fetch('/api/users/mute', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          musicMuted: nextState
        })
      });
    } catch (error) {
      console.error('Error updating audio settings:', error);
    }
  }

  const cardStyle = {
    backgroundColor: '#1c1e25',
    border: '1px solid #2a2d38',
    color: '#e8e4dc',
    padding: '20px',
    borderRadius: '12px',
    maxWidth: '320px',
    marginBottom: '15px'
  };

  const buttonStyle = {
    backgroundColor: isMuted ? '#2a2d38' : '#c0392b',
    color: '#e8e4dc',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%'
  };

  return (
    <div style={cardStyle}>
      <h5 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>
        Audio Preferences
      </h5>
      <button onClick={toggleMute} style={buttonStyle}>
        {isMuted ? '🔇 Unmute Game Music' : '🔊 Mute Game Music'}
      </button>
    </div>
  );
}
