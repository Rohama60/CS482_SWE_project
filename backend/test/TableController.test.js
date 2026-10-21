
import { jest, describe, test, expect, beforeEach } from '@jest/globals';


const mockDeleteTable = jest.fn();

const mockUpdateTable = jest.fn();

const mockFindTableById = jest.fn();

// Replace the real DAO module BEFORE importing the controller
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    createTable: jest.fn(),
    findAllTables: jest.fn(),
    findTableById: mockFindTableById,
    deleteTable: mockDeleteTable,
    updateTable: mockUpdateTable
}));

// Import the REAL controller after registering the mock
const { DeleteTableController } =
    await import('../src/controllers/TableController.js');

const { UpdateTableController } =
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
            error: 'Invalid table ID'
        });
    });
 });
    
describe("Update Table Controller Tests",() =>{

        beforeEach(() => {
            mockFindTableById.mockReset();
            mockUpdateTable.mockReset();
        });
        test("Successful Table Update", async () => {

// Original table
        let table = {
            _id: '507f1f77bcf86cd799439011',
            name: "Outdated Table Name",
            stakes: "low",
            players: 2,
            seats: 4,
            bots: 1,
            isPrivate: true
        };

        mockFindTableById.mockResolvedValue(table);

        // New values
        const updateData = {
            name: "Updated Table Name",
            stakes: "medium",
            players: 4,
            seats: 6,
            bots: 2,
            isPrivate: false
        };

        // Simulate the DAO updating the table
        mockUpdateTable.mockImplementation(async (id, data) => {
        if (id !== table._id) {
             return null;
        }
        table = { ...table, ...data };
        return table;
        });

        const req = {
        params: { id: table._id },
        body: updateData
        };

        const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
        };

        await UpdateTableController(req, res);

        expect(mockUpdateTable).toHaveBeenCalledWith(
        req.params.id,
        req.body
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(table).toEqual({
            _id: '507f1f77bcf86cd799439011',
            name: "Updated Table Name",
            stakes: "medium",
            players: 4,
            seats: 6,
            bots: 2,
            isPrivate: false
        });

        expect(res.json).toHaveBeenCalledWith({
            message: "Table updated",
            table: table
        });
    });

    test("Update Nonexistent Table", async () => {
        const req = {
            params: { id: '507f1f77bcf86cd799439012' },
            body: {
                name: "Nonexistent Table",
                stakes: "high",
                players: 3,
                seats: 5,
                bots: 1,
                isPrivate: true
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindTableById.mockResolvedValue(null);

        await UpdateTableController(req, res);

        expect(mockUpdateTable).not.toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: "Invalid table ID"
        });
    });
});

