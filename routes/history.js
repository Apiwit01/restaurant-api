const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/history - ดึงข้อมูลประวัติการทำอาหารทั้งหมด
router.get('/', async (req, res) => {
    // ดึงค่า startDate และ endDate จาก query string (เช่น /api/history?startDate=2025-01-01)
    const { startDate, endDate } = req.query;

    try {
        let sql = `
            SELECT 
                cl.log_id,
                cl.quantity,
                cl.cooked_at,
                m.name as menu_name,
                u.username as user_name
            FROM 
                cooking_logs cl
            JOIN 
                menus m ON cl.menu_id = m.menu_id
            JOIN 
                users u ON cl.user_id = u.user_id
        `;

        const queryParams = [];
        const whereClauses = [];

        // สร้างเงื่อนไข WHERE แบบไดนามิกตาม query ที่ส่งมา
        if (startDate) {
            whereClauses.push('DATE(cl.cooked_at) >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereClauses.push('DATE(cl.cooked_at) <= ?');
            queryParams.push(endDate);
        }

        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }

        sql += ' ORDER BY cl.cooked_at DESC'; // เรียงลำดับจากล่าสุดไปเก่าสุด

        const [historyLogs] = await db.query(sql, queryParams);

        res.status(200).json(historyLogs);

    } catch (error) {
        console.error("Error fetching cooking history:", error);
        res.status(500).json({ message: 'Error fetching cooking history', error: error.message });
    }
});

module.exports = router;