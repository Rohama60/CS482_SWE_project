import Account from '../models/AccountModel.js';

export async function createAccount(accountData) {
    const account = new Account(accountData);
    return await account.save();
}

export async function findAccountByEmail(email) {
    return await Account.findOne({ email : email });
}

export async function findAccountByUsername(username) {
    return await Account.findOne({ username : username });
}



