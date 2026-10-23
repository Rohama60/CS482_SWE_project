/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemberResetForm, AdminResetForm } from '../src/components/MemberResetForm.tsx';

// Mock global fetch before tests run
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Password updated successfully.' }),
    })
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('MemberResetForm Component', () => {
  test('renders member reset form correctly', () => {
    render(<MemberResetForm />);
    
    expect(screen.getByText(/Forgot My Password \(Member Recovery\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Your Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/New Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
  });

  test('submits email and new password and displays success message', async () => {
    render(<MemberResetForm />);

    const emailInput = screen.getByPlaceholderText(/Your Email/i);
    const passwordInput = screen.getByPlaceholderText(/New Password/i);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newsecurepass123' } });
    fireEvent.click(submitButton);

    // Verify fetch was called with correct endpoint and payload
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', newPassword: 'newsecurepass123' }),
    });

    // Verify success message appears from the mocked response
    await waitFor(() => {
      expect(screen.getByText('Password updated successfully.')).toBeInTheDocument();
    });
  });
});

describe('AdminResetForm Component', () => {
  test('renders admin reset form correctly', () => {
    render(<AdminResetForm />);
    
    expect(screen.getByText(/\[Admin Panel\] Assist User Password Reset/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Target User ID/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Generated Temporary Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Force Reset User Password/i })).toBeInTheDocument();
  });

  test('submits target user ID and temporary password and displays success status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Admin successfully reset user password.' }),
    });

    render(<AdminResetForm />);

    const userIdInput = screen.getByPlaceholderText(/Target User ID/i);
    const tempPassInput = screen.getByPlaceholderText(/Generated Temporary Password/i);
    const submitButton = screen.getByRole('button', { name: /Force Reset User Password/i });

    fireEvent.change(userIdInput, { target: { value: 'user123' } });
    fireEvent.change(tempPassInput, { target: { value: 'temppass999' } });
    fireEvent.click(submitButton);

    // Verify fetch was called with correct admin endpoint and payload
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: 'user123', newPassword: 'temppass999' }),
    });

    // Verify admin success message appears
    await waitFor(() => {
      expect(screen.getByText('Admin successfully reset user password.')).toBeInTheDocument();
    });
  });
});