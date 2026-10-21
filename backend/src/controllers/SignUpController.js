import bcrypt from 'bcrypt';
import { createAccount , findAccountByEmail, findAccountByUsername } from '../dao/AccountDAO.js';


export async function SignUpController(req, res){
    const { name, email, username, password } = req.body;
    if(!name || !email || !username || !password){
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingEmail = await findAccountByEmail(email);
    
    
    if(existingEmail){
        return res.status(409).json({ error: 'Email already in use' });
    }
    

    const existingUsername = await findAccountByUsername(username);
    if(existingUsername){
        return res.status(409).json({ error: 'Username already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await createAccount({
        name,
        email,
        username,
        passwordHash
    });

    return res.status(200).json({
      message: 'Account created successfully'
    });
  }