import React, { useState } from 'react';

export function MemberResetForm() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    });
    const data = await res.json();
    setMessage(data.message || data.error);
  };

  const theme = {
    bg: '#1c1e25',
    inputBg: '#131418',
    border: '#2a2d38',
    text: '#e8e4dc',
    accent: '#c0392b',
    success: '#2ecc71',
    info: '#3498db'
  };

  return (
    <div style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, padding: '24px', borderRadius: '12px', maxWidth: '400px', marginBottom: '20px' }}>
      <h4 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Forgot My Password (Member Recovery)</h4>
      <form onSubmit={handleReset}>
        <div style={{ marginBottom: '16px' }}>
          <input 
            type="email" 
            style={{ width: '100%', padding: '10px 12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.text, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Your Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <input 
            type="password" 
            style={{ width: '100%', padding: '10px 12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.text, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            placeholder="New Password" 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" style={{ backgroundColor: theme.accent, color: theme.text, border: 'none', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
          Reset Password
        </button>
      </form>
      {message && <p style={{ marginTop: '12px', color: theme.info, fontSize: '0.9rem', textAlign: 'center' }}>{message}</p>}
    </div>
  );
}

export function AdminResetForm() {
  const [targetUserId, setTargetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleAdminReset = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, newPassword })
    });
    const data = await res.json();
    setStatus(data.message || data.error);
  };

  const theme = {
    bg: '#1c1e25',
    inputBg: '#131418',
    border: '#2a2d38',
    text: '#e8e4dc',
    adminAccent: '#d35400',
    success: '#2ecc71'
  };

  return (
    <div style={{ backgroundColor: theme.bg, border: `1px solid ${theme.adminAccent}`, color: theme.text, padding: '24px', borderRadius: '12px', maxWidth: '400px', marginBottom: '20px' }}>
      <h4 style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#f39c12' }}>[Admin Panel] Assist User Password Reset</h4>
      <form onSubmit={handleAdminReset}>
        <div style={{ marginBottom: '16px' }}>
          <input 
            type="text" 
            style={{ width: '100%', padding: '10px 12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.text, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Target User ID" 
            value={targetUserId} 
            onChange={e => setTargetUserId(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <input 
            type="text" 
            style={{ width: '100%', padding: '10px 12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.text, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Generated Temporary Password" 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" style={{ backgroundColor: '#f39c12', color: '#1c1e25', border: 'none', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
          Force Reset User Password
        </button>
      </form>
      {status && <p style={{ marginTop: '12px', color: theme.success, fontSize: '0.9rem', textAlign: 'center' }}>{status}</p>}
    </div>
  );
}
