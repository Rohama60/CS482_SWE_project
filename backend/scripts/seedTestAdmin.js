import '../src/loadEnv.js';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function seedTestAdmin() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('The test admin seed is disabled in production.');
    }

    const email = process.env.TEST_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.TEST_ADMIN_PASSWORD;
    const username = process.env.TEST_ADMIN_USERNAME?.trim() || 'test-admin';

    if (!process.env.MONGODB_URI) {
        throw new Error('Set MONGODB_URI before creating a test admin.');
    }
    if (!email || !password) {
        throw new Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD before creating a test admin.');
    }
    if (password.length < 8 || password.length > 128) {
        throw new Error('TEST_ADMIN_PASSWORD must be between 8 and 128 characters.');
    }

    const [{ auth, mongoClient }, { default: Account }] = await Promise.all([
        import('../src/Auth.js'),
        import('../src/models/AccountModel.js'),
    ]);

    try {
        await mongoClient.connect();
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.MONGODB_DB_NAME || 'poker',
        });

        const existingAccount = await Account.findOne({ email }).select('role').lean();
        if (existingAccount) {
            const message = existingAccount.role === 'admin'
                ? 'A test admin with this email already exists; its password was not changed.'
                : 'This email belongs to an existing non-admin account; refusing to promote it.';
            throw new Error(message);
        }

        const result = await auth.api.signUpEmail({
            body: { name: 'Test Admin', email, username, password },
            headers: new Headers(),
            returnHeaders: true,
        });
        const userId = result.response?.user?.id;
        if (!userId) {
            throw new Error('Better Auth did not return the newly created user.');
        }

        const adminAccount = await Account.findOneAndUpdate(
            { userId },
            { $set: { role: 'admin' } },
            { new: true },
        );
        if (!adminAccount) {
            throw new Error('The login was created, but its application account could not be promoted.');
        }

        console.log(`Created test admin ${email}. Log in using this email and TEST_ADMIN_PASSWORD.`);
    } finally {
        await Promise.all([mongoose.disconnect(), mongoClient.close()]);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    seedTestAdmin().catch((error) => {
        console.error(`Test admin setup failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    });
}
