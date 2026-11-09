import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminUserManagement } from '../frontend/src/components/AdminUserManagement';

// Mock global fetch
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
        lastActive: new Date().toISOString()
      }
    ]
  } as Response);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders admin user management dashboard and displays user data', async () => {
  render(<AdminUserManagement />);

  expect(screen.getByText(/Admin Dashboard: User Management/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('$1,500')).toBeInTheDocument();
  });
});
