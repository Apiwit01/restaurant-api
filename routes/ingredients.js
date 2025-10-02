const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect, checkRole } = require('../middleware/authMiddleware');

// GET /api/ingredients - ทุกคนที่ Login สามารถดูได้
router.get('/', protect, async (req, res) => {
    try {
        const { category } = req.query;
        let sql = 'SELECT * FROM ingredients';
        const params = [];
        if (category && category !== 'ทั้งหมด') {
            sql += ' WHERE category = ?';
            params.push(category);
        }
        sql += ' ORDER BY name';
        const [rows] = await db.query(sql, params);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ingredients', error: error });
    }
});

// POST /api/ingredients - เฉพาะ admin และ manager
router.post('/', protect, checkRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, category, unit, quantity, threshold, expiry_date, cost_price } = req.body;
        if (!name || !unit || !category) {
            return res.status(400).json({ message: 'Name, unit, and category are required' });
        }
        const sql = 'INSERT INTO ingredients (name, category, unit, cost_price, quantity, threshold, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const [result] = await db.query(sql, [name, category, unit, cost_price || 0, quantity || 0, threshold || 0, expiry_date || null]);
        res.status(201).json({ message: 'Ingredient created successfully!', ingredientId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating ingredient', error: error });
    }
});

// PUT /api/ingredients/:id - เฉพาะ admin และ manager
router.put('/:id', protect, checkRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, unit, quantity, threshold, expiry_date, cost_price } = req.body;
        if (!name || !unit || !category) {
             return res.status(400).json({ message: 'All fields are required: name, unit, category' });
        }
        const sql = 'UPDATE ingredients SET name = ?, category = ?, unit = ?, cost_price = ?, quantity = ?, threshold = ?, expiry_date = ? WHERE ingredient_id = ?';
        const [result] = await db.query(sql, [name, category, unit, cost_price, quantity, threshold, expiry_date || null, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        res.status(200).json({ message: 'Ingredient updated successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating ingredient', error: error });
    }
});

// DELETE /api/ingredients/:id - เฉพาะ admin และ manager
router.delete('/:id', protect, checkRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM ingredients WHERE ingredient_id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        res.status(200).json({ message: 'Ingredient deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting ingredient', error: error });
    }
});

module.exports = router;