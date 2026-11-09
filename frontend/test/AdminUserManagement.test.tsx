import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminUserManagement } from '../components/AdminUserManagement';

describe('AdminUserManagement Component', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          _id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          balance: 1500,
          role: 'user',
          lastActive: '2026-01-01T00:00:00.000Z'
        }
      ]
    } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders admin user management dashboard and displays user data', async () => {
    render(<AdminUserManagement />);

    // Header check
    expect(screen.getByText(/Admin Dashboard: User Management/i)).toBeInTheDocument();

    // Async data check
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('$1,500')).toBeInTheDocument();
    });
  });
});
