const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const { protect, checkRole } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// GET /api/menus - ทุกคนที่ Login สามารถดูได้
router.get('/', protect, async (req, res) => {
    try {
        const [menus] = await db.query('SELECT menu_id, name, price, image_url FROM menus ORDER BY name');
        for (const menu of menus) {
            const recipeSql = `SELECT i.quantity, i.threshold FROM menu_ingredients mi JOIN ingredients i ON mi.ingredient_id = i.ingredient_id WHERE mi.menu_id = ?`;
            const [ingredients] = await db.query(recipeSql, [menu.menu_id]);
            menu.stock_status = 'ปกติ'; 
            for (const ingredient of ingredients) {
                if (ingredient.quantity <= ingredient.threshold) {
                    menu.stock_status = 'ใกล้หมด';
                    break;
                }
            }
        }
        res.status(200).json(menus);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching menus', error: error.message });
    }
});

// GET /api/menus/:id - ทุกคนที่ Login สามารถดูได้
router.get('/:id', protect, async (req, res) => {
    const { id } = req.params;
    try {
        const [menuRows] = await db.query('SELECT * FROM menus WHERE menu_id = ?', [id]);
        if (menuRows.length === 0) {
            return res.status(404).json({ message: 'Menu not found' });
        }
        const recipeSql = `SELECT mi.ingredient_id, i.name, mi.amount, mi.unit FROM menu_ingredients mi JOIN ingredients i ON mi.ingredient_id = i.ingredient_id WHERE mi.menu_id = ?`;
        const [recipeRows] = await db.query(recipeSql, [id]);
        res.status(200).json({ ...menuRows[0], ingredients: recipeRows });
    } catch (error) {
        console.error('Error fetching menu details:', error);
        res.status(500).json({ message: 'Error fetching menu details', error: error.message });
    }
});

// POST /api/menus - เฉพาะ admin และ manager
router.post('/', protect, checkRole('admin', 'manager'), upload.single('image'), async (req, res) => {
    let connection;
    try {
        const { name, price } = req.body;
        const ingredients = req.body.ingredients ? JSON.parse(req.body.ingredients) : [];
        const imageUrl = req.file ? `images/${req.file.filename}` : null;
        connection = await db.getConnection();
        await connection.beginTransaction();
        const menuSql = 'INSERT INTO menus (name, price, image_url) VALUES (?, ?, ?)';
        const [menuResult] = await connection.query(menuSql, [name, price, imageUrl]);
        const newMenuId = menuResult.insertId;
        if (ingredients.length > 0) {
            const recipeSql = 'INSERT INTO menu_ingredients (menu_id, ingredient_id, amount, unit) VALUES ?';
            const recipeValues = ingredients.map(item => [newMenuId, item.ingredient_id, item.amount, item.unit]);
            await connection.query(recipeSql, [recipeValues]);
        }
        await connection.commit();
        res.status(201).json({ message: 'Menu created successfully!', menuId: newMenuId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating menu:', error);
        res.status(500).json({ message: 'Error creating menu', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/menus/:id - เฉพาะ admin และ manager
router.put('/:id', protect, checkRole('admin', 'manager'), upload.single('image'), async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { name, price } = req.body;
        const ingredients = req.body.ingredients ? JSON.parse(req.body.ingredients) : [];
        let imageUrl = req.body.existing_image_url === 'null' ? null : req.body.existing_image_url;
        if (req.file) {
            imageUrl = `images/${req.file.filename}`;
        }
        connection = await db.getConnection();
        await connection.beginTransaction();
        const menuSql = 'UPDATE menus SET name = ?, price = ?, image_url = ? WHERE menu_id = ?';
        await connection.query(menuSql, [name, price, imageUrl, id]);
        const deleteRecipeSql = 'DELETE FROM menu_ingredients WHERE menu_id = ?';
        await connection.query(deleteRecipeSql, [id]);
        if (ingredients.length > 0) {
            const recipeSql = 'INSERT INTO menu_ingredients (menu_id, ingredient_id, amount, unit) VALUES ?';
            const recipeValues = ingredients.map(item => [id, item.ingredient_id, item.amount, item.unit]);
            await connection.query(recipeSql, [recipeValues]);
        }
        await connection.commit();
        res.status(200).json({ message: 'Menu updated successfully!' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating menu:', error);
        res.status(500).json({ message: 'Error updating menu', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /api/menus/:id - เฉพาะ admin และ manager
router.delete('/:id', protect, checkRole('admin', 'manager'), async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM menus WHERE menu_id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Menu not found' });
        }
        res.status(200).json({ message: 'Menu deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting menu', error: error.message });
    }
});

module.exports = router;