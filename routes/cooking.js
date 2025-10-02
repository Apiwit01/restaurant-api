// --- 1. แก้ไขจาก import เป็น require ---
const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.post('/', async (req, res) => {
    const { menu_id, quantity, user_id } = req.body;

    if (!menu_id || !quantity || !user_id) {
        return res.status(400).json({ message: 'menu_id, quantity, and user_id are required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const recipeSql = 'SELECT * FROM menu_ingredients WHERE menu_id = ?';
        const [recipeItems] = await connection.query(recipeSql, [menu_id]);

        if (recipeItems.length === 0) {
            throw new Error('Recipe not found for this menu.');
        }

        for (const item of recipeItems) {
            const requiredAmount = item.amount * quantity;

            const [currentStock] = await connection.query('SELECT * FROM ingredients WHERE ingredient_id = ? FOR UPDATE', [item.ingredient_id]);

            if (currentStock.length === 0 || currentStock[0].quantity < requiredAmount) {
                throw new Error(`Insufficient stock for ingredient ID: ${item.ingredient_id}`);
            }

            const newQuantity = currentStock[0].quantity - requiredAmount;

            const updateStockSql = 'UPDATE ingredients SET quantity = ? WHERE ingredient_id = ?';
            await connection.query(updateStockSql, [newQuantity, item.ingredient_id]);

            const stockLogSql = 'INSERT INTO stock_logs (ingredient_id, changed_by, change_type, amount, description) VALUES (?, ?, ?, ?, ?)';
            await connection.query(stockLogSql, [
                item.ingredient_id, 
                user_id,
                'deduct',
                -requiredAmount, 
                `Deducted for menu ID: ${menu_id}`
            ]);
        }

        const cookingLogSql = 'INSERT INTO cooking_logs (user_id, menu_id, quantity) VALUES (?, ?, ?)';
        await connection.query(cookingLogSql, [user_id, menu_id, quantity]);

        await connection.commit();
        res.status(200).json({ message: 'Cooking process completed and stock updated successfully!' });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error during cooking transaction:', error);
        res.status(500).json({ message: 'Failed to process cooking request.', error: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// --- 2. แก้ไขจาก export default เป็น module.exports ---
module.exports = router;