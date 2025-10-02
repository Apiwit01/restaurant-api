const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect, checkRole } = require('../middleware/authMiddleware'); // 1. Import "ยาม" เข้ามา

// 2. สั่งให้ทุกเส้นทาง (route) ในไฟล์นี้ ต้องผ่าน "ยาม" สองชั้น
// ชั้นแรก: ต้อง Login (protect)
// ชั้นสอง: ต้องมี Role เป็น 'admin' หรือ 'manager' เท่านั้น (checkRole)
router.use(protect, checkRole('admin', 'manager'));

// GET /api/reports/usage-trends - ดึงข้อมูลแนวโน้มการใช้วัตถุดิบตามช่วงวันที่
router.get('/usage-trends', async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required.' });
    }
    try {
        const sql = `
            SELECT 
                DATE(created_at) as date, 
                SUM(ABS(amount)) as total_usage 
            FROM 
                stock_logs
            WHERE 
                change_type = 'deduct' AND DATE(created_at) BETWEEN ? AND ?
            GROUP BY 
                DATE(created_at)
            ORDER BY 
                date ASC;
        `;
        const [rows] = await db.query(sql, [startDate, endDate]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching usage trends', error: error.message });
    }
});

// GET /api/reports/cost-summary - ดึงข้อมูลสรุปค่าใช้จ่ายวัตถุดิบตามช่วงวันที่
router.get('/cost-summary', async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required.' });
    }
    try {
        const sql = `
            SELECT 
                i.name as ingredient_name, 
                SUM(ABS(sl.amount) * i.cost_price) as total_cost
            FROM 
                stock_logs sl
            JOIN 
                ingredients i ON sl.ingredient_id = i.ingredient_id
            WHERE 
                sl.change_type = 'deduct' AND DATE(sl.created_at) BETWEEN ? AND ?
            GROUP BY 
                i.name
            ORDER BY 
                total_cost DESC;
        `;
        const [rows] = await db.query(sql, [startDate, endDate]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cost summary', error: error.message });
    }
});

module.exports = router;