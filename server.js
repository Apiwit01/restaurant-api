// File: server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import Routes
const ingredientRoutes = require('./routes/ingredients');
const menuRoutes = require('./routes/menus');
const cookingRoutes = require('./routes/cookingRoutes'); // <-- แก้ไขชื่อไฟล์ให้ตรงกับไฟล์จริงๆ
const dashboardRoutes = require('./routes/dashboard');
const historyRoutes = require('./routes/historyRoutes'); // <-- แก้ไขชื่อไฟล์ให้ตรงกับไฟล์จริงๆ
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/userRoutes');       // <-- แก้ไขชื่อไฟล์ให้ตรงกับไฟล์จริงๆ
const suggestionRoutes = require('./routes/suggestions');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public/images')));


// ใช้ Routes
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/cook', cookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/suggestions', suggestionRoutes);

// --- ลบบรรทัดที่ซ้ำซ้อน 2 บรรทัดนี้ออก ---
// app.use('/api/history', require('./routes/historyRoutes'));
// app.use('/api/cook', require('./routes/cookingRoutes'));

// --- ลบโค้ดสำหรับ Debug ที่ไม่จำเป็นแล้วออก ---
// const listEndpoints = require('express-list-endpoints');
// console.log('--- Registered Routes ---');
// console.log(listEndpoints(app));
// console.log('-------------------------');

// เริ่ม Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});