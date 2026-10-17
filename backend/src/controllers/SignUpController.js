export function SignUpController(req, res){
    const { name, email, username, password } = req.body;
    if(!name || !email || !username || !password){
        return res.status(400).json({ error: 'Missing required fields' });
    }


  return res.status(200).json({
    message: 'Signup information validated'
  });
}