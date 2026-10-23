/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AudioSettings } from '../src/components/AudioSettings.tsx';

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

describe('AudioSettings Component', () => {
  test('renders audio preferences with default unmuted state', () => {
    render(<AudioSettings userId="123" />);
    
    expect(screen.getByText('Audio Preferences')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Game Music/i })).toBeInTheDocument();
  });

  test('toggles mute state, updates button text, and sends PATCH request', async () => {
    render(<AudioSettings userId="123" />);

    const button = screen.getByRole('button', { name: /Mute Game Music/i });
    fireEvent.click(button);

    // Verify fetch was called with correct endpoint and payload
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/users/mute', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: '123',
        musicMuted: true,
      }),
    });

    // Verify the button text changes to reflect the muted state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unmute Game Music/i })).toBeInTheDocument();
    });
  });
});