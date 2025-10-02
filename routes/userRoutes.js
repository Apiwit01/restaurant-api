const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/userController'); // <-- สมมติว่าคุณมี controller
const { protect } = require('../middleware/authMiddleware'); // <-- Import middleware เข้ามา

// POST /api/users/register
router.post('/register', registerUser);

// POST /api/users/login
router.post('/login', loginUser);

// --- เพิ่ม Route นี้เข้าไป ---
// GET /api/users/me
// ใช้ 'protect' middleware เพื่อตรวจสอบ token ก่อน
router.get('/me', protect, (req, res) => {
    // ถ้า token ถูกต้อง, middleware จะแนบข้อมูล user มาให้ใน req.user
    // เราแค่ส่งข้อมูลนั้นกลับไป
    res.status(200).json(req.user);
});
// --- สิ้นสุดส่วนที่เพิ่ม ---


module.exports = router;