import 'dotenv/config';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { betterAuth } from 'better-auth';
import Account from './models/AccountModel.js';

const mongoClient = new MongoClient(process.env.MONGODB_URI);
const database = mongoClient.db(process.env.MONGODB_DB_NAME || 'poker');

export const auth = betterAuth({
  database: mongodbAdapter(database, { client: mongoClient }),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: [process.env.FRONTEND_URL || 'http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
      },
  
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const account = await Account.create(
            { userId: user.id, displayName: user.name, chipamount: 500 }
          );
          
        },
      },
    },
  },
});

export { mongoClient };
