
import { jest, describe, test, expect, beforeEach } from '@jest/globals';


const mockDeleteTable = jest.fn();

// Replace the real DAO module BEFORE importing the controller
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    createTable: jest.fn(),
    findAllTables: jest.fn(),
    findTableById: jest.fn(),
    deleteTable: mockDeleteTable
}));

// Import the REAL controller after registering the mock
const { DeleteTableController } =
    await import('../src/controllers/TableController.js');

describe('Delete Table Controller Tests from MongoDB', () => {

    beforeEach(() => {
        mockDeleteTable.mockReset();
    });

    test('client successfully deletes a table', async () => {

        // Simulate the client requesting deletion
        const req = {
            params: { id: '507f1f77bcf86cd799439011' }
        };

        // Simulate Express response
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Pretend the DAO successfully deleted the table
        mockDeleteTable.mockResolvedValue({
            _id: req.params.id,
            name: 'Poker Room'
        });

        // Execute the REAL controller
        await DeleteTableController(req, res);

        // Verify the controller called the DAO
        expect(mockDeleteTable).toHaveBeenCalledWith(req.params.id);
        expect(mockDeleteTable).toHaveBeenCalledTimes(1);

        // Verify the response sent to the client
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Table deleted'
        });
    });

    test('client tries to delete a nonexistent table', async () => {

        const req = {
            params: { id: '507f1f77bcf86cd799439012' }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Pretend the DAO couldn't find the table
        mockDeleteTable.mockResolvedValue(null);

        await DeleteTableController(req, res);

        expect(mockDeleteTable).toHaveBeenCalledWith(req.params.id);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Table not found'
        });
    });
});

