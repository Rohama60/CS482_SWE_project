

import {jest, describe, it, expect }  from '@jest/globals';

jest.unstable_mockModule('../src/dao/AccountDAO.js', () => ({
    createAccount: jest.fn(),
    findAccountByEmail: jest.fn(),
    findAccountByUsername: jest.fn()
}));



const { SignUpController } =
await import('../src/controllers/SignUpController.js');
const { findAccountByEmail, findAccountByUsername, createAccount } = await import('../src/dao/AccountDAO.js');
describe("Sign Up Testing", () => {
    
    test("Successful sign up", async () => {
        const req = {
            body: {
                name : "Test User",
                username: "testuser",
                email: "testuser@example.com",
                password: "password123"
            }
        }

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }

        await SignUpController(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Account created successfully'
        });
    });
    
    test("Missing required fields", async () => {
        const req = {
            body: {
                name : "Test User",
                username: "testuser",
                email: "",
                password: "password123"
            }
        }

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
        
        await SignUpController(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
    test("Email already in use", async () => {
          
        findAccountByEmail.mockResolvedValue({
                name: "Cool",
                username: "upperuser",
                email: "testuser@example.com"
        });


       
        const duplicateEmailReq = {
            body: {
                name : "Nice",
                username: "loweruser",
                email: "testuser@example.com",
                password: "powerfulpassword"
            }
        };
        const duplicateEmailRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await SignUpController(duplicateEmailReq, duplicateEmailRes);
        
        expect(duplicateEmailRes.status).toHaveBeenCalledWith(409);
        expect(duplicateEmailRes.json).toHaveBeenCalledWith({
            error: 'Email already in use'
        });
        expect(createAccount).not.toHaveBeenCalled();
       

    });
})