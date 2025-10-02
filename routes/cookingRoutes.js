const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const db = require('../config/db');

// POST /api/cook
router.post('/', protect, async (req, res) => {
    const { menu_id, quantity } = req.body;
    const userId = req.user.id; 

    if (!menu_id || !quantity || !userId) {
        return res.status(400).json({ message: 'menu_id, quantity, and user_id are required' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // --- 1. แก้ไขชื่อคอลัมน์ใน SQL Query ---
        const [recipeItems] = await connection.query(
            'SELECT ingredient_id, amount FROM menu_ingredients WHERE menu_id = ?', // เปลี่ยนจาก quantity_required เป็น amount
            [menu_id]
        );

        if (recipeItems.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'ไม่พบสูตรสำหรับเมนูนี้' });
        }

        for (const item of recipeItems) {
            const [stock] = await connection.query(
                'SELECT name, quantity FROM ingredients WHERE ingredient_id = ? FOR UPDATE',
                [item.ingredient_id]
            );
            
            // --- 2. แก้ไขชื่อ property ตอนเปรียบเทียบสต็อก ---
            if (stock.length === 0 || stock[0].quantity < (item.amount * quantity)) { // เปลี่ยนจาก item.quantity_required เป็น item.amount
                await connection.rollback();
                return res.status(400).json({ message: `วัตถุดิบ '${stock[0]?.name || 'ไม่ทราบชื่อ'}' ไม่เพียงพอ` });
            }
        }

        for (const item of recipeItems) {
            // --- 3. แก้ไขชื่อ property ตอนตัดสต็อก ---
            await connection.query(
                'UPDATE ingredients SET quantity = quantity - ? WHERE ingredient_id = ?',
                [(item.amount * quantity), item.ingredient_id] // เปลี่ยนจาก item.quantity_required เป็น item.amount
            );
        }
        
        await connection.query(
            'INSERT INTO cooking_logs (menu_id, user_id, quantity) VALUES (?, ?, ?)',
            [menu_id, userId, quantity]
        );
        
        await connection.commit();
        res.status(201).json({ message: 'บันทึกการทำอาหารและตัดสต็อกเรียบร้อย' });

    } catch (error) {
        await connection.rollback();
        console.error('Cooking transaction failed:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการทำรายการ' });
    } finally {
        connection.release();
    }
});

module.exports = router;