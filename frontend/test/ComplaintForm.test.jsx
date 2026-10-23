/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComplaintForm } from '../src/components/ComplaintForm.tsx';

// Mock global fetch before tests run
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      })
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ComplaintForm Component', () => {
  test('renders complaint form correctly with default values', () => {
    render(<ComplaintForm reporterId="user-abc-123" />);
    
    expect(screen.getByText('File a User Complaint')).toBeInTheDocument();
    expect(screen.getByLabelText(/Offending Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Altercation Details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Complaint/i })).toBeInTheDocument();
  });

  test('submits form data with reporterId and displays success message', async () => {
    render(<ComplaintForm reporterId="user-abc-123" />);

    const usernameInput = screen.getByLabelText(/Offending Username/i);
    const reasonSelect = screen.getByLabelText(/Reason/i);
    const detailsTextarea = screen.getByLabelText(/Altercation Details/i);
    const submitButton = screen.getByRole('button', { name: /Submit Complaint/i });

    // Simulate user filling out the form
    fireEvent.change(usernameInput, { target: { value: 'rulebreaker99' } });
    fireEvent.change(reasonSelect, { target: { value: 'Collusion' } });
    fireEvent.change(detailsTextarea, { target: { value: 'Teaming up in poker chat.' } });
    fireEvent.click(submitButton);

    // Verify fetch was called with the correct endpoint and payload
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: 'user-abc-123',
        reportedUsername: 'rulebreaker99',
        reason: 'Collusion',
        details: 'Teaming up in poker chat.',
      }),
    });

    // Verify success confirmation appears on screen
    await waitFor(() => {
      expect(screen.getByText(/Complaint submitted\. An admin will review the altercation\./i)).toBeInTheDocument();
    });
  });
});