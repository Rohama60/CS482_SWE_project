import { useState, useEffect, useCallback } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  balance: number;
  role: string;
  lastActive: string;
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('lastActive');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to retrieve user directory');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setUsers(users.filter(u => u._id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateBalance = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/balance`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ balance: newBalance }),
      });
      if (!res.ok) throw new Error('Failed to update balance');
      const updatedUser = await res.json();
      setUsers(users.map(u => (u._id === id ? updatedUser : u)));
      setEditingUserId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Inline Style Definitions ---
  const containerStyle = {
    backgroundColor: '#1c1e25',
    border: '1px solid #2a2d38',
    color: '#e8e4dc',
    padding: '24px',
    borderRadius: '12px',
    maxWidth: '900px',
    margin: '20px auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  };

  const controlsStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const
  };

  const inputStyle = {
    backgroundColor: '#2a2d38',
    border: '1px solid #3a3f4d',
    color: '#e8e4dc',
    padding: '10px 14px',
    borderRadius: '8px',
    flex: '1',
    minWidth: '220px',
    outline: 'none'
  };

  const selectStyle = {
    backgroundColor: '#2a2d38',
    border: '1px solid #3a3f4d',
    color: '#e8e4dc',
    padding: '10px 14px',
    borderRadius: '8px',
    outline: 'none',
    cursor: 'pointer'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
    fontSize: '0.95rem'
  };

  const thTdStyle = {
    padding: '12px 14px',
    borderBottom: '1px solid #2a2d38'
  };

  const badgeStyle = (isAdmin: boolean) => ({
    backgroundColor: isAdmin ? '#c0392b' : '#2980b9',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 'bold' as const
  });

  const buttonStyle = (variant: 'danger' | 'warning' | 'success' | 'secondary') => {
    const bgColors = {
      danger: '#c0392b',
      warning: '#d35400',
      success: '#27ae60',
      secondary: '#2a2d38'
    };
    return {
      backgroundColor: bgColors[variant],
      color: '#e8e4dc',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: 'bold' as const,
      fontSize: '0.85rem',
      marginRight: '6px'
    };
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, color: '#f1c40f', fontSize: '1.3rem' }}>
          Admin Dashboard: User Management
        </h3>
        <span style={{ backgroundColor: '#27ae60', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
          Total Users: {users.length}
        </span>
      </div>

      {/* Controls Bar */}
      <div style={controlsStyle}>
        <input
          type="text"
          style={inputStyle}
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select 
          style={selectStyle}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="lastActive">Sort by Last Active</option>
          <option value="balance">Sort by Highest Balance</option>
        </select>
      </div>

      {error && <div style={{ color: '#e74c3c', marginBottom: '15px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>Loading user database...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ color: '#95a5a6', borderBottom: '2px solid #2a2d38' }}>
                <th style={thTdStyle}>User Details</th>
                <th style={thTdStyle}>Role</th>
                <th style={thTdStyle}>Balance</th>
                <th style={thTdStyle}>Activity Status</th>
                <th style={thTdStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td style={thTdStyle}>
                    <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#95a5a6' }}>{user.email}</div>
                  </td>
                  <td style={thTdStyle}>
                    <span style={badgeStyle(user.role === 'admin')}>
                      {user.role}
                    </span>
                  </td>
                  <td style={thTdStyle}>
                    {editingUserId === user._id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="number"
                          style={{ ...inputStyle, padding: '4px 8px', width: '90px' }}
                          value={newBalance}
                          onChange={(e) => setNewBalance(Number(e.target.value))}
                        />
                        <button 
                          style={buttonStyle('success')}
                          onClick={() => handleUpdateBalance(user._id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
                        ${user.balance.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td style={thTdStyle}>
                    <span style={{ fontSize: '0.85rem', color: '#3498db' }}>
                      {new Date(user.lastActive).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={thTdStyle}>
                    {editingUserId !== user._id && (
                      <button
                        style={buttonStyle('warning')}
                        onClick={() => {
                          setEditingUserId(user._id);
                          setNewBalance(user.balance);
                        }}
                      >
                        Edit Balance
                      </button>
                    )}
                    <button
                      style={buttonStyle('danger')}
                      onClick={() => handleDelete(user._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
