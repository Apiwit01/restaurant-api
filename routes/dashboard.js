const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
    try {
        // Query 1: Low stock, Today's Sales
        const statsSql = `
            SELECT 
                (SELECT COUNT(*) FROM ingredients WHERE quantity <= threshold) as low_stock_count,
                (SELECT SUM(m.price * cl.quantity) FROM cooking_logs cl JOIN menus m ON cl.menu_id = m.menu_id WHERE DATE(cl.cooked_at) = CURDATE()) as today_sales;
        `;
        const [statsResult] = await db.query(statsSql);

        // Query 2: Total sales, Total orders
        const totalsSql = `
            SELECT 
                (SELECT SUM(m.price * cl.quantity) FROM cooking_logs cl JOIN menus m ON cl.menu_id = m.menu_id) as total_sales,
                (SELECT COUNT(*) FROM cooking_logs) as total_orders;
        `;
        const [totalsResult] = await db.query(totalsSql);

        // Query 3: Best seller today
        const bestSellerSql = `
            SELECT m.name as best_seller_today
            FROM cooking_logs cl
            JOIN menus m ON cl.menu_id = m.menu_id
            WHERE DATE(cl.cooked_at) = CURDATE()
            GROUP BY cl.menu_id, m.name
            ORDER BY SUM(cl.quantity) DESC
            LIMIT 1
        `;
        const [bestSellerResult] = await db.query(bestSellerSql);

        // Query 4: Sales for the last 7 days
        const salesLast7DaysSql = `
            SELECT 
                DATE_FORMAT(d.date, '%Y-%m-%d') as date, 
                COALESCE(SUM(m.price * cl.quantity), 0) as sales
            FROM (
                SELECT CURDATE() - INTERVAL (a.a) DAY as date
                FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) as a
            ) d
            LEFT JOIN cooking_logs cl ON DATE(cl.cooked_at) = d.date
            LEFT JOIN menus m ON cl.menu_id = m.menu_id
            WHERE d.date BETWEEN CURDATE() - INTERVAL 6 DAY AND CURDATE()
            GROUP BY d.date
            ORDER BY d.date ASC;
        `;
        const [salesLast7Days] = await db.query(salesLast7DaysSql);

        // Query 5: Top 5 low stock items
        const lowStockItemsSql = 'SELECT name, quantity, unit FROM ingredients WHERE quantity <= threshold ORDER BY quantity ASC LIMIT 5';
        const [lowStockItems] = await db.query(lowStockItemsSql);

        // ประกอบข้อมูลทั้งหมดส่งกลับไป
        const dashboardData = {
            stats: {
                low_stock_count: statsResult[0].low_stock_count || 0,
                today_sales: statsResult[0].today_sales || 0, // <-- แก้ไขให้ดึงจาก statsResult
                total_sales: totalsResult[0].total_sales || 0,
                total_orders: totalsResult[0].total_orders || 0,
                best_seller_today: bestSellerResult.length > 0 ? bestSellerResult[0].best_seller_today : 'ยังไม่มี'
            },
            salesLast7Days: salesLast7Days,
            lowStockItems: lowStockItems
        };

        res.status(200).json(dashboardData);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
    }
});

module.exports = router;