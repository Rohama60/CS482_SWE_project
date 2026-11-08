/**
 * @jest-environment jsdom
 */

import React from 'react';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SignUpView } from '../src/views/SignUpView.tsx';

describe('SignUpView Component Tests', () => {

    let mockOnClose;
    let mockOnSuccess;

    beforeEach(() => {
        mockOnClose = jest.fn();
        mockOnSuccess = jest.fn();

        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    // TEST 1
    test('Renders signup form correctly', () => {

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        expect(screen.getByText('Join the table')).toBeInTheDocument();

        expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();

        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();

        expect(screen.getByPlaceholderText('RoyalFlushKing')).toBeInTheDocument();

        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();

        expect(screen.getByRole('button', { name: 'Create Account' }))
            .toBeInTheDocument();
    });


    // TEST 2
    test('Allows user to enter signup information', () => {

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        const nameInput = screen.getByPlaceholderText('John Doe');
        const emailInput = screen.getByPlaceholderText('you@example.com');
        const usernameInput = screen.getByPlaceholderText('RoyalFlushKing');
        const passwordInput = screen.getByPlaceholderText('••••••••');
        const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');

        fireEvent.change(nameInput, {
            target: { value: 'John Smith' }
        });

        fireEvent.change(emailInput, {
            target: { value: 'john@example.com' }
        });

        fireEvent.change(usernameInput, {
            target: { value: 'john123' }
        });

        fireEvent.change(passwordInput, {
            target: { value: 'password123' }
        });
        fireEvent.change(confirmPasswordInput, {
            target: { value: 'password123' }
        });

        expect(nameInput).toHaveValue('John Smith');
        expect(emailInput).toHaveValue('john@example.com');
        expect(usernameInput).toHaveValue('john123');
        expect(passwordInput).toHaveValue('password123');
        expect(confirmPasswordInput).toHaveValue('password123');
    });


    // TEST 3
    test('Successfully creates account and calls onSuccess', async () => {

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                user: {
                    id: '123',
                    name: 'John Smith'
                }
            })
        });

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.change(screen.getByPlaceholderText('John Doe'), {
            target: { value: 'John Smith' }
        });

        fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
            target: { value: 'john@example.com' }
        });

        fireEvent.change(screen.getByPlaceholderText('RoyalFlushKing'), {
            target: { value: 'john123' }
        });

        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'password123' }
        });
        fireEvent.change(screen.getByPlaceholderText('Confirm your password'), {
            target: { value: 'password123' }
        });

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        expect(global.fetch).toHaveBeenCalledWith('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                name: 'John Smith',
                email: 'john@example.com',
                password: 'password123',
                confirmPassword: 'password123',
                username: 'john123'
            })
        });
    });

    test('Displays an error and does not submit when passwords do not match', async () => {
        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'password123' }
        });
        fireEvent.change(screen.getByPlaceholderText('Confirm your password'), {
            target: { value: 'differentpassword' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

        expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });


    // TEST 4
    test('Displays error when email already exists', async () => {

        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({
                error: 'Email already in use'
            })
        });

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        expect(await screen.findByText('Email already in use'))
            .toBeInTheDocument();

        expect(mockOnSuccess).not.toHaveBeenCalled();
    });


    // TEST 5
    test('Displays default error when backend provides no error message', async () => {

        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({})
        });

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        expect(await screen.findByText('Failed to sign up'))
            .toBeInTheDocument();

        expect(mockOnSuccess).not.toHaveBeenCalled();
    });


    // TEST 6
    test('Displays error when network request fails', async () => {

        global.fetch.mockRejectedValue(
            new Error('Network connection failed')
        );

        const consoleSpy = jest.spyOn(console, 'error')
            .mockImplementation(() => {});

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        expect(await screen.findByText('Network connection failed'))
            .toBeInTheDocument();

        expect(mockOnSuccess).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });


    // TEST 7
    test('Calls onClose when close button is clicked', () => {

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: '✕'
        }));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });


    // TEST 8
    test('Disables submit button while signup request is processing', async () => {

        let resolveRequest;

        global.fetch.mockImplementation(() =>
            new Promise(resolve => {
                resolveRequest = resolve;
            })
        );

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        expect(screen.getByRole('button', {
            name: 'Creating Account...'
        })).toBeDisabled();

        resolveRequest({
            ok: true,
            json: jest.fn().mockResolvedValue({})
        });

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });
    });


    // TEST 9
    test('Re-enables submit button after signup fails', async () => {

        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({
                error: 'Signup failed'
            })
        });

        render(
            <SignUpView
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', {
            name: 'Create Account'
        }));

        expect(await screen.findByText('Signup failed'))
            .toBeInTheDocument();

        expect(screen.getByRole('button', {
            name: 'Create Account'
        })).toBeEnabled();
    });
    // Test 10 
    test('Changes border colors for all signup inputs on focus and blur', () => {

    render(
        <SignUpView
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
        />
    );

    const placeholders = [
        'John Doe',
        'you@example.com',
        'RoyalFlushKing',
        '••••••••'
    ];

    placeholders.forEach(placeholder => {

        const input = screen.getByPlaceholderText(placeholder);

        // Test onFocus
        fireEvent.focus(input);

        expect(input).toHaveStyle({
            borderColor: '#c0392b'
        });

        // Test onBlur
        fireEvent.blur(input);

        expect(input).toHaveStyle({
            borderColor: '#2a2d38'
        });

    });
        


    });
});