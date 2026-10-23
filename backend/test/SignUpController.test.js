import {jest, describe, it, expect, beforeEach }  from '@jest/globals';
import { APIError }  from 'better-auth/api';

const mockSignUpEmail = jest.fn();

jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: {
        api: {
            signUpEmail: mockSignUpEmail
        }
    }
}));

const { SignUpController } = await import('../src/controllers/SignUpController.js');

describe("Sign Up Testing", () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Successful sign up", async () => {
        mockSignUpEmail.mockResolvedValue({
            response: {
                message: 'Account created successfully' 
            },

            headers: new Headers()
     });
     
     const req = {
        headers: new Headers(),
        body: {
            name : "Test User",
            username: "testuser",
            email: "testuser@example.com",
            password: "password123"
        }
    };

    const res = {
        setHeader: jest.fn(),
         status: jest.fn().mockReturnThis(),
         json: jest.fn()
    };

    await SignUpController(req, res);

    expect(mockSignUpEmail).toHaveBeenCalledWith({
        body: req.body,
        headers: req.headers,
        returnHeaders: true
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
         message: 'Account created successfully'
     });
 });
    
 test("Missing required fields", async () => {
    const req = {
        headers: {},
         body: {
            name : "Test User",
            username: "testuser",
            email: "",
            password: "password123"
         }
     };

    const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
     };
        
    await SignUpController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields'
    });
    expect(mockSignUpEmail).not.toHaveBeenCalled();
});
    
test("Email already in use", async () => {
    mockSignUpEmail.mockRejectedValue(
        new APIError('CONFLICT',{
            message: 'Email already in use',
        })
    );
    
    const req = {
        headers: {},
        body: {
            name : "Nice",
            username: "loweruser",
            email: "testuser@example.com",
            password: "powerfulpassword"
        }
    };

    const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    await SignUpController(req, res);
        
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
        error: 'Email already in use'
    });
       
});

test("Username already in use", async () => {
    mockSignUpEmail.mockRejectedValue(
        new APIError('CONFLICT',{
            message: 'Username already in use',
        })
    );

    const req = {
        headers: {},
        body: {
            name : "Nice",
            username: "upperuser",
            email: "different@example.com",
            password: "powerfulpassword"
        }
    };

    const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
        
    await SignUpController(req, res);
        
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
        error: 'Username already in use'
     });
       
});
test('Returns 500 when unexpected signup error occurs', async () => {

    // Simulate unexpected database or server error
    const unexpectedError = new Error('Database connection failed');

    mockSignUpEmail.mockRejectedValue(unexpectedError);

    const req = {
        body: {
            name: 'John Smith',
            email: 'john@example.com',
            username: 'john123',
            password: 'password123'
        },
        headers: {}
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
    };

    // Prevent expected error from appearing in console
    const consoleSpy = jest.spyOn(console, 'error')
        .mockImplementation(() => {});

    await SignUpController(req, res);

    // Verify signup was attempted
    expect(mockSignUpEmail).toHaveBeenCalledTimes(1);

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
        'Sign up failed:',
        unexpectedError
    );

    // Verify HTTP 500 response
    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to create account'
    });

    consoleSpy.mockRestore();
});
});