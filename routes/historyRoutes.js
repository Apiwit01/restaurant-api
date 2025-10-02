const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const db = require('../config/db');

// GET /api/history/me -> ดึงประวัติของ user ที่ login อยู่เท่านั้น
// Endpoint นี้คือตัวที่แอปมือถือเรียกใช้
router.get('/me', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const [userLogs] = await db.query(
            `SELECT logs.log_id, logs.quantity, logs.cooked_at, menus.name AS menu_name 
             FROM cooking_logs logs
             JOIN menus ON logs.menu_id = menus.menu_id
             WHERE logs.user_id = ? 
             ORDER BY logs.cooked_at DESC`,
            [userId]
        );
        res.json(userLogs);
    } catch (error) {
        console.error("Error fetching user history:", error);
        res.status(500).json({ message: 'Server Error while fetching user history' });
    }
});

// GET /api/history -> ดึงประวัติทั้งหมด (สำหรับ Admin บนหน้าเว็บ)
router.get('/', protect, async (req, res) => {
    try {
        const [allLogs] = await db.query(
            `SELECT logs.log_id, logs.quantity, logs.cooked_at, menus.name AS menu_name, users.username AS user_name 
             FROM cooking_logs logs
             JOIN menus ON logs.menu_id = menus.menu_id
             JOIN users ON logs.user_id = users.user_id
             ORDER BY logs.cooked_at DESC`
        );
        res.json(allLogs);
    } catch (error) {
        console.error("Error fetching all history:", error);
        res.status(500).json({ message: 'Server Error while fetching all history' });
    }
});

module.exports = router;