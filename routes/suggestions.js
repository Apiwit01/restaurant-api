const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect, checkRole } = require('../middleware/authMiddleware');

// GET /api/suggestions/purchase-order
// ป้องกันเส้นทางนี้ ให้เข้าถึงได้เฉพาะ admin และ manager
router.get('/purchase-order', protect, checkRole('admin', 'manager'), async (req, res) => {
    try {
        // 1. ค้นหาวัตถุดิบทั้งหมดที่ปริมาณคงเหลือ (quantity) น้อยกว่าหรือเท่ากับจุดสั่งซื้อ (threshold)
        const findItemsSql = `
            SELECT 
                ingredient_id, 
                name, 
                quantity, 
                threshold, 
                unit,
                cost_price
            FROM ingredients 
            WHERE quantity <= threshold AND threshold > 0;
        `;
        const [itemsToOrder] = await db.query(findItemsSql);

        // 2. สำหรับแต่ละรายการ คำนวณปริมาณที่แนะนำให้สั่งซื้อ
        const suggestedOrder = itemsToOrder.map(item => {
            // Logic การคำนวณ (เวอร์ชันแรก): สั่งเพิ่มอีก 2 เท่าของ threshold
            // เช่น threshold คือ 5, เราจะแนะนำให้สั่งเพิ่ม 10 ชิ้น
            const suggested_quantity = item.threshold * 2;
            const estimated_cost = suggested_quantity * item.cost_price;

            return {
                ...item,
                suggested_quantity,
                estimated_cost
            };
        });

        res.status(200).json(suggestedOrder);

    } catch (error) {
        console.error("Error generating purchase order suggestion:", error);
        res.status(500).json({ message: 'Error generating suggestion', error: error.message });
    }
});

module.exports = router;