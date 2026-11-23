import { useState, type FormEvent } from 'react';

const containerStyle = {
  backgroundColor: '#1c1e25',
  border: '1px solid #2a2d38',
  color: '#e8e4dc',
  padding: '24px',
  borderRadius: '12px',
  maxWidth: '460px',
  margin: '20px auto',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
};

const compactContainerStyle = {
  backgroundColor: '#1c1e25',
  border: '1px solid #2a2d38',
  color: '#e8e4dc',
  padding: '14px',
  borderRadius: '10px',
  marginTop: '8px',
  boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px'
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px'
};

const inlineFormStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '8px',
  alignItems: 'center'
};

const inputStyle = {
  backgroundColor: '#2a2d38',
  border: '1px solid #3a3f4d',
  color: '#e8e4dc',
  padding: '10px 14px',
  borderRadius: '8px',
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
  fontSize: '0.95rem'
};

const inlineInputStyle = {
  backgroundColor: '#2a2d38',
  border: '1px solid #3a3f4d',
  color: '#e8e4dc',
  padding: '7px 10px',
  borderRadius: '6px',
  minWidth: '180px',
  outline: 'none',
  fontSize: '0.85rem'
};

const buttonStyle = (variant: 'primary' | 'success' | 'secondary', disabled = false) => {
  const bgColors = {
    primary: '#c0392b',
    success: '#27ae60',
    secondary: '#2a2d38'
  };

  return {
    backgroundColor: bgColors[variant],
    color: '#e8e4dc',
    border: variant === 'secondary' ? '1px solid #3a3f4d' : 'none',
    padding: '9px 14px',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
    fontWeight: 'bold' as const,
    fontSize: '0.9rem'
  };
};

export function MemberResetForm() {
  const [email, setEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setMessage(null);
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          newPassword
        })
      });

      const data = await res.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to reset password');
      }

      setMessage(data?.message || 'Password reset successful. You can now sign in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, color: '#f1c40f', fontSize: '1.25rem' }}>
          Reset Password
        </h3>
        <span style={{ backgroundColor: '#2a2d38', border: '1px solid #3a3f4d', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#95a5a6' }}>
          Member Access
        </span>
      </div>

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="email"
          required
          style={inputStyle}
          placeholder="Account email address"
          aria-label="Account email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          required
          minLength={8}
          style={inputStyle}
          placeholder="New password (8+ characters)"
          aria-label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <input
          type="password"
          required
          minLength={8}
          style={inputStyle}
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={submitting}
          style={buttonStyle('primary', submitting)}
        >
          {submitting ? 'Resetting Password...' : 'Reset Password'}
        </button>
      </form>

      {message && (
        <div style={{ color: '#27ae60', marginTop: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ color: '#e74c3c', marginTop: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function AdminResetForm({
  targetUserId,
  targetName,
  onClose
}: {
  targetUserId: string;
  targetName?: string;
  onClose?: () => void;
}) {
  const [newPassword, setNewPassword] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetUserId || submitting) return;

    setMessage(null);
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId,
          newPassword
        })
      });

      const data = await res.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to update user password');
      }

      setMessage(data?.message || `Password updated for ${targetName || targetUserId}`);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to update user password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={compactContainerStyle}>
      <div style={{ fontSize: '0.8rem', color: '#f1c40f', fontWeight: 'bold', marginBottom: '8px' }}>
        Admin Password Override {targetName ? `— ${targetName}` : ''}
      </div>

      <form onSubmit={handleSubmit} style={inlineFormStyle}>
        <input
          type="password"
          required
          minLength={8}
          style={inlineInputStyle}
          placeholder="New password (8+ chars)"
          aria-label={targetName ? `New password for ${targetName}` : 'New password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={submitting || !newPassword.trim()}
          style={buttonStyle('success', submitting || !newPassword.trim())}
        >
          {submitting ? 'Saving...' : 'Update Password'}
        </button>

        {onClose && (
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={buttonStyle('secondary', submitting)}
          >
            Close
          </button>
        )}
      </form>

      {message && (
        <div style={{ color: '#27ae60', marginTop: '8px', fontSize: '0.82rem', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ color: '#e74c3c', marginTop: '8px', fontSize: '0.82rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}
    </div>
  );
}
