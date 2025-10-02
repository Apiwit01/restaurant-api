const db = require('../config/db');

// @desc    Get all menus
// @route   GET /api/menus
const getAllMenus = async (req, res) => {
    try {
        // --- ส่วนสำคัญ: ดึงข้อมูลทั้งหมดจากตาราง menus ---
        // ตรวจสอบให้แน่ใจว่าตาราง menus ของคุณมีคอลัมน์ image_url
        const [menus] = await db.query('SELECT * FROM menus ORDER BY name ASC');
        res.status(200).json(menus);
    } catch (error) {
        console.error('Error fetching menus:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single menu by ID
// @route   GET /api/menus/:id
const getMenuById = async (req, res) => {
    try {
        const [menu] = await db.query('SELECT * FROM menus WHERE menu_id = ?', [req.params.id]);
        if (menu.length === 0) {
            return res.status(404).json({ message: 'Menu not found' });
        }
        res.status(200).json(menu[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// --- ที่เหลือคือฟังก์ชันสำหรับ เพิ่ม, แก้ไข, ลบ ซึ่งคุณอาจจะมีอยู่แล้ว ---
// ถ้ายังไม่มี สามารถใช้โค้ดนี้เป็นต้นแบบได้เลย

// @desc    Create a new menu
// @route   POST /api/menus
const createMenu = async (req, res) => {
    // (ส่วนนี้จะซับซ้อนขึ้นถ้ามีการอัปโหลดรูปภาพเข้ามาเกี่ยวข้อง)
    const { name, price, category } = req.body;
    if (!name || !price) {
        return res.status(400).json({ message: 'Please provide name and price' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO menus (name, price, category) VALUES (?, ?, ?)',
            [name, price, category || 'ทั่วไป']
        );
        res.status(201).json({ menu_id: result.insertId, name, price, category });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


module.exports = {
    getAllMenus,
    getMenuById,
    createMenu,
    // เพิ่ม updateMenu, deleteMenu ที่นี่ถ้าคุณสร้างมันขึ้นมา
};