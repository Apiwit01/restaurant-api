const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect, checkRole } = require('../middleware/authMiddleware');

// POST /api/users/register - Endpoint สำหรับสมัครสมาชิก (แก้ไขใหม่)
router.post('/register', 
    // Middleware แบบมีเงื่อนไข:
    // ถ้า role ที่ส่งมาคือ 'admin', ให้ "ยาม" ทำงาน
    // ถ้าเป็น role อื่น ให้ผ่านไปได้เลย
    (req, res, next) => {
        if (req.body.role === 'admin') {
            // เรียกใช้ middleware protect และ checkRole('admin') ต่อ
            protect(req, res, () => checkRole('admin')(req, res, next));
        } else {
            next(); // ถ้าเป็น role 'kitchen' ให้ข้ามการตรวจสอบไปเลย
        }
    }, 
    async (req, res) => {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Username, password, and role are required.' });
        }
        try {
            let [userRows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
            if (userRows.length > 0) {
                return res.status(400).json({ message: 'Username already exists.' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
            await db.query(sql, [username, hashedPassword, role]);
            res.status(201).json({ message: 'User registered successfully!' });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).send('Server error');
        }
    }
);

// POST /api/users/login (Endpoint นี้เปิดสาธารณะ ไม่ต้องป้องกัน)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const payload = { user: { id: user.user_id, username: user.username, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: payload.user });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error');
    }
});

// GET /api/users/stats/:id (Endpoint นี้ควรจะให้ทุกคนที่ Login แล้วดูได้)
router.get('/stats/:id', protect, async (req, res) => {
    const { id } = req.params;
    try {
        const todaySql = 'SELECT COUNT(*) as cooked_today FROM cooking_logs WHERE user_id = ? AND DATE(cooked_at) = CURDATE()';
        const [todayResult] = await db.query(todaySql, [id]);
        const weekSql = 'SELECT COUNT(*) as cooked_this_week FROM cooking_logs WHERE user_id = ? AND cooked_at >= CURDATE() - INTERVAL 7 DAY';
        const [weekResult] = await db.query(weekSql, [id]);
        const favoriteSql = `
            SELECT m.name
            FROM cooking_logs cl
            JOIN menus m ON cl.menu_id = m.menu_id
            WHERE cl.user_id = ?
            GROUP BY cl.menu_id, m.name
            ORDER BY COUNT(cl.menu_id) DESC
            LIMIT 1
        `;
        const [favoriteResult] = await db.query(favoriteSql, [id]);
        const stats = {
            cooked_today: todayResult[0].cooked_today || 0,
            cooked_this_week: weekResult[0].cooked_this_week || 0,
            favorite_menu: favoriteResult.length > 0 ? favoriteResult[0].name : 'ยังไม่มี'
        };
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;