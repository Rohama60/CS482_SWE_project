/**
 * @jest-environment jsdom
 */

import {
    jest,
    describe,
    test,
    expect,
    beforeEach,
    afterEach
} from '@jest/globals';

import {
    render,
    screen,
    fireEvent,
    waitFor
} from '@testing-library/react';

import '@testing-library/jest-dom';

// Mock functions
const mockUseSession = jest.fn();
const mockSignOut = jest.fn();
const mockStartGuestSession = jest.fn();

// Mock Better Auth
jest.mock('../src/AuthClient.ts', () => ({
    authClient: {
        useSession: (...args) => mockUseSession(...args),
        signOut: (...args) => mockSignOut(...args)
    }
}));

// Mock guest session
jest.mock('../src/guestSession.ts', () => ({
    startGuestSession: (...args) => mockStartGuestSession(...args)
}));

// Mock audio settings
jest.mock('../src/components/AudioSettings.tsx', () => ({
    AudioSettings: ({ userId }) => (
        <div data-testid="audio-settings">
            Audio Settings - {userId}
        </div>
    )
}));

import Home from '../src/views/Home.tsx';

describe('Home Component Tests', () => {

    let mockSetView;
    let mockOnSignUp;
    let mockOnSignIn;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSetView = jest.fn();
        mockOnSignUp = jest.fn();
        mockOnSignIn = jest.fn();

        // Default: user is not signed in
        mockUseSession.mockReturnValue({
            data: null
        });

        mockStartGuestSession.mockResolvedValue({});
        mockSignOut.mockResolvedValue({ error: null });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderHome() {
        return render(
            <Home
                view="home"
                setView={mockSetView}
                onSignUp={mockOnSignUp}
                onSignIn={mockOnSignIn}
            />
        );
    }
    test('Renders home page correctly', () => {

    renderHome();

    expect(screen.getByText('Royal Draw')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /five card draw/i }))
        .toBeInTheDocument();

    expect(screen.getByText('Play as Guest')).toBeInTheDocument();

    expect(screen.getByText('Best hand wins the pot'))
        .toBeInTheDocument();

    });

    test('Displays guest options when user is not signed in', () => {

    renderHome();

    expect(screen.getByRole('button', { name: /play as guest/i }))
        .toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: /log in/i }))
        .toHaveLength(2);

    expect(screen.getAllByRole('button', { name: /create account/i }))
        .toHaveLength(2);

    expect(screen.queryByText('500 Chips'))
        .not.toBeInTheDocument();

    });
    test('Guest successfully enters lobby', async () => {

    renderHome();

    fireEvent.click(
        screen.getByRole('button', { name: /play as guest/i })
    );

    await waitFor(() => {
        expect(mockStartGuestSession).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
        expect(mockSetView).toHaveBeenCalledWith('lobby');
    });

    });
    test('Displays alert when guest session fails', async () => {

    mockStartGuestSession.mockRejectedValue(
        new Error('Backend unavailable')
    );

    const alertSpy = jest.spyOn(window, 'alert')
        .mockImplementation(() => {});

    const consoleSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});

    renderHome();

    fireEvent.click(
        screen.getByRole('button', { name: /play as guest/i })
    );

    await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
            'Could not start a guest game. Is the backend running?'
        );
    });

    expect(mockSetView).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    consoleSpy.mockRestore();

    });
    test('Log in buttons call onSignIn', () => {

    renderHome();

    // Both the top bar button and the middle button now say "Log In"
    const logInButtons = screen.getAllByRole('button', { name: /log in/i });
    expect(logInButtons).toHaveLength(2);
    logInButtons.forEach(button => fireEvent.click(button));

    expect(mockOnSignIn).toHaveBeenCalledTimes(2);

    });
    test('Create Account buttons call onSignUp', () => {

    renderHome();

    const signupButtons = screen.getAllByRole('button', {
        name: /create account/i
    });

    signupButtons.forEach(button => {
        fireEvent.click(button);
    });

    expect(mockOnSignUp).toHaveBeenCalledTimes(2);

    });
    test('Displays signed-in user information', () => {

    mockUseSession.mockReturnValue({
        data: {
            user: {
                id: '123',
                name: 'John Smith'
            }
        }
    });

    renderHome();

    expect(screen.getByText('John Smith'))
        .toBeInTheDocument();

    expect(screen.getByText(/500 Chips/i))
        .toBeInTheDocument();

    expect(screen.getByRole('button', {
        name: /play at a poker table/i
    })).toBeInTheDocument();

    expect(screen.queryByRole('button', {
        name: /play as guest/i
    })).not.toBeInTheDocument();

    });
    test('Successfully signs out user', async () => {

    // Simulate a signed-in user
    mockUseSession.mockReturnValue({
        data: {
            user: {
                id: '123',
                name: 'John Smith'
            }
        }
    });

    // Simulate successful sign-out
    mockSignOut.mockResolvedValue({
        error: null
    });

    renderHome();

    // Open profile dropdown
    fireEvent.click(
        screen.getByRole('button', {
            name: /john smith/i
        })
    );

    // Verify dropdown is open
    expect(screen.getByRole('menu'))
        .toBeInTheDocument();

    // Click Sign out
    fireEvent.click(
        screen.getByRole('menuitem', {
            name: /sign out/i
        })
    );

    // Verify Better Auth signOut was called
    await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    // Verify profile dropdown closes
    await waitFor(() => {
        expect(screen.queryByRole('menu'))
            .not.toBeInTheDocument();
    });

    });
    test('Handles sign out exception', async () => {

    mockUseSession.mockReturnValue({
        data: {
            user: {
                id: '123',
                name: 'John Smith'
            }
        }
    });

    mockSignOut.mockRejectedValue(
        new Error('Network error')
    );

    const consoleSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});

    renderHome();

    fireEvent.click(
        screen.getByRole('button', {
            name: /john smith/i
        })
    );

    fireEvent.click(
        screen.getByRole('menuitem', {
            name: /sign out/i
        })
    );

    await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
            'Sign out failed:',
            expect.any(Error)
        );
    });

    // Finally block resets the button
    await waitFor(() => {
        expect(screen.getByRole('menuitem', {
            name: /sign out/i
        })).not.toBeDisabled();
    });

    });
    test('Signed-in user can play at a poker table', () => {

    mockUseSession.mockReturnValue({
        data: {
            user: {
                id: '123',
                name: 'John Smith'
            }
        }
    });

    renderHome();

    // Verify signed-in button appears
    const playButton = screen.getByRole('button', {
        name: /play at a poker table/i
    });

    expect(playButton).toBeInTheDocument();

    // Verify description
    expect(screen.getByText(/prepare for a thrilling game of poker/i))
        .toBeInTheDocument();

    // Verify button styling
    expect(playButton).toHaveStyle({
        border: '1px solid rgba(192,57,43,0.3)'
    });

    // Guest button should not appear
    expect(screen.queryByRole('button', {
        name: /play as guest/i
    })).not.toBeInTheDocument();

    // Click play button
    fireEvent.click(playButton);

    // Verify navigation to lobby
    expect(mockSetView).toHaveBeenCalledWith('lobby');

});
test('Guest buttons work correctly with hover effects', async () => {

    // Simulate no signed-in user
    mockUseSession.mockReturnValue({
        data: null
    });

    mockStartGuestSession.mockResolvedValue({});

    renderHome();

    // PLAY AS GUEST
    const guestButton = screen.getByRole('button', {
        name: /play as guest/i
    });

    expect(guestButton).toBeInTheDocument();

    expect(screen.getByText('Jump in instantly'))
        .toBeInTheDocument();

    fireEvent.click(guestButton);

    await waitFor(() => {
        expect(mockStartGuestSession).toHaveBeenCalledTimes(1);
        expect(mockSetView).toHaveBeenCalledWith('lobby');
    });

    // LOGIN BUTTON
    // The middle Log In card (the top bar button says Log In too)
    const loginButton = screen.getByRole('button', {
        name: /resume your streak/i
    });

    expect(screen.getByText('Resume your streak'))
        .toBeInTheDocument();

    // Test onMouseEnter
    fireEvent.mouseEnter(loginButton);

    expect(loginButton).toHaveStyle({
        borderColor: 'rgba(192,57,43,0.5)'
    });

    // Test onMouseLeave
    fireEvent.mouseLeave(loginButton);

    expect(loginButton).toHaveStyle({
        borderColor: '#2a2d38'
    });

    // Click login
    fireEvent.click(loginButton);

    expect(mockOnSignIn).toHaveBeenCalledTimes(1);

    // CREATE ACCOUNT BUTTON
    const signupButtons = screen.getAllByRole('button', {
        name: /create account/i
    });

    // Second button is the main Create Account button
    const signupButton = signupButtons[1];

    expect(screen.getByText('Track wins & stats'))
        .toBeInTheDocument();

    // Test onMouseEnter
    fireEvent.mouseEnter(signupButton);

    expect(signupButton).toHaveStyle({
        borderColor: 'rgba(192,57,43,0.75)'
    });

    // Test onMouseLeave
    fireEvent.mouseLeave(signupButton);

    expect(signupButton).toHaveStyle({
        borderColor: 'rgba(192,57,43,0.4)'
    });

    // Click Create Account
    fireEvent.click(signupButton);

    expect(mockOnSignUp).toHaveBeenCalledTimes(1);

});
test('Audio dropdown opens and closes when clicked', () => {

    renderHome();

    // Find the audio button
    const audioButton = screen.getByRole('button', {
        name: /audio/i
    });

    // Audio settings should initially be hidden
    expect(screen.queryByTestId('audio-settings'))
        .not.toBeInTheDocument();

    // Click audio button to open dropdown
    fireEvent.click(audioButton);

    // Verify audio settings are displayed
    expect(screen.getByTestId('audio-settings'))
        .toBeInTheDocument();

    // Click audio button again to close dropdown
    fireEvent.click(audioButton);

    // Verify audio settings disappear
    expect(screen.queryByTestId('audio-settings'))
        .not.toBeInTheDocument();

});
test('Handles sign out error response', async () => {

    // Simulate a signed-in user
    mockUseSession.mockReturnValue({
        data: {
            user: {
                id: '123',
                name: 'John Smith'
            }
        }
    });

    // Simulate Better Auth returning an error
    const signOutError = {
        message: 'Unable to sign out'
    };

    mockSignOut.mockResolvedValue({
        error: signOutError
    });

    // Prevent expected error from appearing in test output
    const consoleSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});

    renderHome();

    // Open the profile dropdown
    fireEvent.click(
        screen.getByRole('button', {
            name: /john smith/i
        })
    );

    // Verify profile menu is visible
    expect(screen.getByRole('menu'))
        .toBeInTheDocument();

    // Click Sign Out
    fireEvent.click(
        screen.getByRole('menuitem', {
            name: /sign out/i
        })
    );

    // Verify signOut was called and error was logged
    await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);

        expect(consoleSpy).toHaveBeenCalledWith(
            'Sign out failed:',
            signOutError
        );
    });

    // Because sign-out failed, the profile menu stays open
    expect(screen.getByRole('menu'))
        .toBeInTheDocument();

    // Verify the finally block resets signingOut
    await waitFor(() => {
        expect(screen.getByRole('menuitem', {
            name: /sign out/i
        })).not.toBeDisabled();
    });

    consoleSpy.mockRestore();

});


});