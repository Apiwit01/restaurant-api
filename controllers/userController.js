const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// @desc    Register a new user
// @route   POST /api/users/register
const registerUser = async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Please add all fields' });
    }
    try {
        const [userExists] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const [newUser] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
        res.status(201).json({
            user_id: newUser.insertId,
            username: username,
            role: role
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/users/login
const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length > 0 && (await bcrypt.compare(password, users[0].password))) {
            const user = users[0];
            res.json({
                user: {
                    id: user.user_id,
                    username: user.username,
                    role: user.role
                },
                token: generateToken({
                    id: user.user_id,
                    username: user.username,
                    role: user.role
                }),
            });
        } else {
            res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// --- ฟังก์ชันสร้าง Token ---
const generateToken = (userPayload) => {
    return jwt.sign({ user: userPayload }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = {
    registerUser,
    loginUser,
};