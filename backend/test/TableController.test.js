import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockCreateTable = jest.fn();
const mockFindAllTables = jest.fn();
const mockFindTableById = jest.fn();
const mockDeleteTable = jest.fn();
const mockUpdateTable = jest.fn();
const mockFindTableByHost = jest.fn();
const mockFindAccount = jest.fn();
const mockGetSession = jest.fn();

// Replace the real DAO module BEFORE importing the controller
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    createTable: mockCreateTable,
    findAllTables: mockFindAllTables,
    findTableById: mockFindTableById,
    deleteTable: mockDeleteTable,
    updateTable: mockUpdateTable,
    findTablesByHost: mockFindTableByHost
}));

//mock account model
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: {
        findOne: mockFindAccount
    }
}));

//mock authentication
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession
        }
    }
}));



// Import the REAL controller after registering the mock
const { 
    CreateTableController,
    GetTablesController,
    GetTableByIdController,
    GetMyTablesController,
    DeleteTableController,
    UpdateTableController,
} = await import('../src/controllers/TableController.js');

describe('Delete Table Controller Tests from MongoDB', () => {

    beforeEach(() => {
        mockDeleteTable.mockReset();
        mockFindTableById.mockReset();
        mockGetSession.mockReset();
        mockFindAccount.mockReset();

        mockGetSession.mockResolvedValue({
            user: { id: 'testuser' }
        });

        mockFindAccount.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            username: 'testuser'
        });
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

        mockFindTableById.mockResolvedValue({
            _id: req.params.id,
            host: '507f1f77bcf86cd799439011', // same as the account's _id
            name: 'Poker Room'
        });

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
            message: 'Table deleted successfully'
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
        mockFindTableById.mockResolvedValue(null);

        await DeleteTableController(req, res);

        expect(mockFindTableById).toHaveBeenCalledWith(req.params.id);
        expect(mockDeleteTable).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Table not found'
        });
    });

    test('returns 401 when the user is not logged in', async () => {
        mockGetSession.mockResolvedValue(null);

        const req = { headers: {}, params: { id: '507f1f77bcf86cd799439012' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await DeleteTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        expect(mockDeleteTable).not.toHaveBeenCalled();
    });

    test('returns 404 when the account is not found', async () => {
        mockFindAccount.mockResolvedValue(null);

        const req = { headers: {}, params: { id: '507f1f77bcf86cd799439012' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await DeleteTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
        expect(mockDeleteTable).not.toHaveBeenCalled();
    });

    test('returns 400 for a malformed table id', async () => {
        const req = { headers: {}, params: { id: 'not-an-id' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await DeleteTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid table ID' });
        expect(mockFindTableById).not.toHaveBeenCalled();
        expect(mockDeleteTable).not.toHaveBeenCalled();
    });

    test('returns 403 when the user is not the host', async () => {
        const req = { headers: {}, params: { id: '507f1f77bcf86cd799439012' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockFindTableById.mockResolvedValue({
            _id: req.params.id,
            host: 'someoneElse'
        });

        await DeleteTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'You can only delete tables you host' });
        expect(mockDeleteTable).not.toHaveBeenCalled();
    });

    test('returns 500 when the DAO throws', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const req = { headers: {}, params: { id: '507f1f77bcf86cd799439012' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockFindTableById.mockResolvedValue({
            _id: req.params.id,
            host: '507f1f77bcf86cd799439011' // matches the account
        });
        mockDeleteTable.mockRejectedValue(new Error('db down'));

        await DeleteTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete table' });
        spy.mockRestore();
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
            max: 6,
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
        {
            name: 'Updated Table Name',
            stakes: 'medium',
            max: 6,
            bots: 2,
            isPrivate: false,
            blind: '5 / 10' // Updated blind based on stakes

        }

        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(table).toEqual({
            _id: '507f1f77bcf86cd799439011',
            name: "Updated Table Name",
            stakes: "medium",
            blind: "5 / 10",
            max: 6,
            seats: 4,
            players: 2,
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

    test('return 400 for invalid table settings', async () => {
        const req = {
            params: { id: '507f1f77bcf86cd799439011' },
            body: { name: 'Table', stakes: 'insane', max: 6, bots:1, isPrivate: false } // invalid stakes
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockFindTableById.mockResolvedValue({
            _id: req.params.id, 
            players: 2,
        });

        await UpdateTableController(req, res);

        expect(mockUpdateTable).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid table settings'
        });
    });

    test('return 500 when the DAO throws', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const req = {
            params: { id: '507f1f77bcf86cd799439011' },
            body: { name: 'Table', stakes: 'medium', max: 6, bots:1, isPrivate: false }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockFindTableById.mockResolvedValue({ _id: req.params.id, players: 2 });
        mockUpdateTable.mockRejectedValue(new Error('db Error'));

        await UpdateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Failed to update table'
        });
        spy.mockRestore();

    });

});

describe("Create Table Controller Tests", () => {
    const account = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
    };

    beforeEach(() => {
        mockCreateTable.mockReset();
        mockFindAccount.mockReset();
        mockGetSession.mockReset();
    
        mockGetSession.mockResolvedValue({
            user: {id: 'testuser'},
        });

        mockFindAccount.mockResolvedValue(account);
    });

    test("Successful Table Creation", async () => {
        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
                seats: 4,
                bots: 1,
                isPrivate: false
            }
        };
        
        const createdTable = {
            _id: '507f1f77bcf86cd799439012',
            name: 'New Table',
            stakes: 'low',
            blind: '1 / 2',
            max: 4,
            players: 2,
            bots: 1,
            status: 'active',
            isPrivate: false,
            host: account._id
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockCreateTable.mockResolvedValue(createdTable);

        await CreateTableController(req, res);

        expect(mockGetSession).toHaveBeenCalledTimes(1);
        expect(mockFindAccount).toHaveBeenCalledWith({ userId: 'testuser' });
        expect(mockCreateTable).toHaveBeenCalledWith({
            name: 'New Table',
            stakes: 'low',
            blind: '1 / 2',
            max: 4,
            players: 2,
            bots: 1,
            status: 'active',
            isPrivate: false,
            host: account._id,
            // P7: the host takes the first seat; public tables have no invite code
            seats: [{ kind: 'user', refId: String(account._id), displayName: 'testuser' }],
            inviteCode: null
        });

        expect(mockCreateTable).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Table created',
            table: { ...createdTable, inviteCode: null }
        });
    });

    test('rejects creation when user is unauthorized', async () => {
        mockGetSession.mockResolvedValue(null);

        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
                seats: 4,
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await CreateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });

        expect(mockFindAccount).not.toHaveBeenCalled();
        expect(mockCreateTable).not.toHaveBeenCalled();
    });

    test('returns 404 when account is not found', async () => {
        mockFindAccount.mockResolvedValue(null);

        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
                seats: 4,
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await CreateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });

        expect(mockCreateTable).not.toHaveBeenCalled();
    });

    test('reject missing required fields', async () => {
        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
             // seat is missing
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await CreateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
        expect(mockCreateTable).not.toHaveBeenCalled();

    });
        


    test('reject invalid stakes', async () => {
        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'extreme', // invalid stakes
                seats: 4,
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await CreateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid stakes' });
   
        expect(mockCreateTable).not.toHaveBeenCalled();

    });

    test('reject invalid seats', async () => {
        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
                seats: 1, // invalid max

            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await CreateTableController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ 
            error: 'Seats must be between 2 and 6' 
        });

        expect(mockCreateTable).not.toHaveBeenCalled();
    });

    test('reject invalid bots count', async () => {
        const req = {
            headers: {},
            body: {
                name: 'New Table',
                stakes: 'low',
                seats: 4,
                bots: 4 // invalid bots count, should be less than seats
        }
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    await CreateTableController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        error: 'Bots must be between 0 and 3'
    });
    expect(mockCreateTable).not.toHaveBeenCalled();
});
});


describe('Get Tables Controller Tests', () => {
    beforeEach(() => {
        mockFindAllTables.mockReset();
    });

    test('Successfully retrieves all public tables', async () => {
        const tables = [
            {
                _id: 'table1',
                name: 'Poker Room 1',
                stakes: 'low',
                isPrivate: false
            },
            {
                _id: 'table2',
                name: 'Poker Room 2',
                stakes: 'high',
                isPrivate: false
            }
        ];

        const req = {
            query: {}
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindAllTables.mockResolvedValue(tables);

        await GetTablesController(req, res);

        expect(mockFindAllTables).toHaveBeenCalledWith({
            isPrivate: false
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            tables
        });
    });

    test('Filters public tables by stakes', async () => {
        const tables = [
            {
                _id: 'table1',
                name: 'Low Stakes Room',
                stakes: 'low',
                isPrivate: false
            }
        ];

        const req = {
            query: {
                stakes: 'low'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindAllTables.mockResolvedValue(tables);

        await GetTablesController(req, res);

        expect(mockFindAllTables).toHaveBeenCalledWith({
            isPrivate: false,
            stakes: 'low'
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            tables
        });
    });

    test('Returns an empty list when no tables exist', async () => {
        const req = {
            query: {}
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindAllTables.mockResolvedValue([]);

        await GetTablesController(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            tables: []
        });
    });
});

describe('Get Table By ID Controller Tests', () => {
    beforeEach(() => {
        mockFindTableById.mockReset();
    });

    test('Successfully retrieves a table by ID', async () => {
        const table = {
            _id: '507f1f77bcf86cd799439011',
            name: 'Poker Room',
            stakes: 'low',
            blind: '1 / 2',
            max: 4,
            players: 1,
            bots: 0,
            status: 'waiting',
            isPrivate: false
        };

        const req = {
            params: {
                id: table._id
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindTableById.mockResolvedValue(table);

        await GetTableByIdController(req, res);

        expect(mockFindTableById).toHaveBeenCalledWith(table._id);
        expect(mockFindTableById).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            table
        });
    });

    test('Returns 404 when table does not exist', async () => {
        const req = { params: { id: '507f1f77bcf86cd799439012'} };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockFindTableById.mockResolvedValue(null);

        await GetTableByIdController(req, res);

        expect(mockFindTableById).toHaveBeenCalledWith(
            req.params.id
        );

        expect(mockFindTableById).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Table not found'
        });
    });
});

describe('Get My Tables Controller Tests', () => {
    const account = { _id: '507f1f77bcf86cd799439011', username: 'testuser' };

    beforeEach(() => {
        mockFindTableByHost.mockReset();
        mockFindAccount.mockReset();
        mockGetSession.mockReset();

        mockGetSession.mockResolvedValue({ user: { id: 'testuser' } });
        mockFindAccount.mockResolvedValue(account);
    });

    test('returns the tables hosted by the logged-in user', async () => {
        const tables = [{ _id: 'table1', name: 'My Table', host: account._id }];
        const req = { headers: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockFindTableByHost.mockResolvedValue(tables);

        await GetMyTablesController(req, res);

        expect(mockFindAccount).toHaveBeenCalledWith({ userId: 'testuser' });
        expect(mockFindTableByHost).toHaveBeenCalledWith(account._id);
        expect(res.status).toHaveBeenCalledWith(200);
        // P7: the host's own tables include the invite code (null for public tables)
        expect(res.json).toHaveBeenCalledWith({ tables: tables.map(t => ({ ...t, inviteCode: null })) });
    });

    test('returns 401 when the user is not logged in', async () => {
        mockGetSession.mockResolvedValue(null);
        const req = { headers: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await GetMyTablesController(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        expect(mockFindTableByHost).not.toHaveBeenCalled();
    });

    test('returns 404 when the account is not found', async () => {
        mockFindAccount.mockResolvedValue(null);
        const req = { headers: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await GetMyTablesController(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
        expect(mockFindTableByHost).not.toHaveBeenCalled();
    });

    test('returns 500 when the DAO throws', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockFindTableByHost.mockRejectedValue(new Error('db down'));
        const req = { headers: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await GetMyTablesController(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get hosted tables' });
        spy.mockRestore();
    });
});
