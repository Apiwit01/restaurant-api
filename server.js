// File: server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const line = require('@line/bot-sdk');
const cron = require('node-cron');
const axios = require('axios');
const db = require('./config/db');

// Import Routes
const ingredientRoutes = require('./routes/ingredients');
const menuRoutes = require('./routes/menus');
const cookingRoutes = require('./routes/cookingRoutes');
const dashboardRoutes = require('./routes/dashboard');
const historyRoutes = require('./routes/historyRoutes');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/userRoutes');
const suggestionRoutes = require('./routes/suggestions');

const app = express();

// --- ตั้งค่า Config และ Client สำหรับ LINE SDK ---
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};
const lineClient = new line.messagingApi.MessagingApiClient(lineConfig); // สร้าง Client ไว้ใช้ซ้ำ

// Middleware
app.use(cors());
app.post('/api/line/webhook', line.middleware(lineConfig), (req, res) => { // Webhook ต้องอยู่ก่อน express.json()
    Promise
        .all(req.body.events.map(handleLineEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error("Webhook Error:", err);
            res.status(500).end();
        });
});
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public/images')));


// --- ใช้งาน Routes หลักของ API ---
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/cook', cookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/suggestions', suggestionRoutes);


// --- ฟังก์ชันสำหรับจัดการ Event ที่ LINE ส่งมา (เพิ่ม Logic ตอบกลับและสั่งงาน) ---
async function handleLineEvent(event) {
    console.log('Received LINE Event:', JSON.stringify(event, null, 2));

    if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const replyToken = event.replyToken;
        const messageText = event.message.text.toLowerCase().trim(); // แปลงเป็นตัวเล็กและตัดช่องว่าง

        // --- เงื่อนไข 1: ถ้าถามเกี่ยวกับสต็อก ---
        if (messageText.includes('สต็อก')) {
            console.log(`User ${userId} asked about stock.`);
            try {
                const lowStockItems = await getLowStockItems();
                let replyText = '';
                if (lowStockItems.length > 0) {
                    replyText = '📋 รายการวัตถุดิบใกล้หมด:\n';
                    lowStockItems.forEach(item => {
                        replyText += `\n- ${item.name} (เหลือ ${item.quantity} ${item.unit})`;
                    });
                } else {
                    replyText = '✅ ตอนนี้ยังไม่มีวัตถุดิบใกล้หมดครับ';
                }
                await lineClient.replyMessage({
                    replyToken: replyToken, messages: [{ type: 'text', text: replyText }],
                });
                console.log(`Replied stock info to User ${userId}`);
            } catch (error) {
                console.error("Error replying to stock query:", error);
            }
        }
        // --- เงื่อนไข 2: ถ้าสั่งให้ส่งแจ้งเตือนสต็อก ---
        else if (messageText === 'แจ้งเตือนสต็อก' || messageText === 'ส่งแจ้งเตือน') {
            console.log(`User ${userId} requested manual low stock notification.`);
            try {
                // ตอบกลับ User ก่อนว่ากำลังดำเนินการ
                await lineClient.replyMessage({
                     replyToken: replyToken,
                     messages: [{ type: 'text', text: 'กำลังตรวจสอบสต็อกและส่งแจ้งเตือน กรุณารอสักครู่...' }]
                });

                // เรียกใช้ฟังก์ชันดึงข้อมูลและส่งแจ้งเตือน (เหมือนที่ Scheduler ทำ)
                const lowStockItems = await getLowStockItems();
                await sendLineNotification(lowStockItems); // ฟังก์ชันนี้จะส่ง Push Message ไปที่ LINE_TARGET_ID

                console.log(`Manual notification sent triggered by User ${userId}`);

            } catch (error) {
                 console.error("Error triggering manual notification:", error);
                 // (อาจจะไม่ต้องส่ง reply ซ้ำ ถ้าส่งแจ้งเตือนไปแล้ว)
            }
        }
        // --- ถ้าไม่เข้าเงื่อนไขไหนเลย ---
        else {
             console.log(`Received text message "${event.message.text}" from User ${userId}, but no specific action defined.`);
             // (อาจจะตอบกลับข้อความ default ถ้าต้องการ)
        }
    }
    // ... จัดการ Event อื่นๆ เช่น join, follow เหมือนเดิม ...

    return Promise.resolve(null);
}

// --- ฟังก์ชันสำหรับ Scheduler (เหมือนเดิม) ---
async function getLowStockItems() {
    try {
        const [lowStockItems] = await db.query(
            `SELECT name, quantity, unit FROM ingredients WHERE quantity <= threshold ORDER BY name ASC`
        );
        return lowStockItems;
    } catch (error) {
        console.error("Scheduler/Webhook: Error fetching low stock items:", error);
        return [];
    }
}

async function sendLineNotification(items) {
    if (items.length === 0) {
        console.log("Notification: No low stock items to notify.");
        // อาจจะส่งข้อความบอกว่าไม่มีของหมดก็ได้ ถ้าต้องการ
        // await lineClient.pushMessage({ to: process.env.LINE_TARGET_ID, messages: [{ type: 'text', text: '✅ ตรวจสอบสต็อกแล้ว: ยังไม่มีวัตถุดิบใกล้หมด' }] });
        return;
    }
    let textMessage = '🚨 รายการวัตถุดิบใกล้หมดที่ต้องสั่งซื้อ 🚨\n'; // เปลี่ยน Emoji ให้ต่างจากอัตโนมัติเล็กน้อย
    items.forEach(item => {
        textMessage += `\n- ${item.name} (เหลือ ${item.quantity} ${item.unit})`;
    });
    try {
        await lineClient.pushMessage({
            to: process.env.LINE_TARGET_ID,
            messages: [{ type: 'text', text: textMessage }],
        });
        console.log("Notification: Successfully sent LINE notification.");
    } catch (error) {
        console.error("Notification: Failed to send LINE Push Message:", error.response ? error.response.data : error.message);
    }
}

// --- ตั้งเวลาทำงาน Scheduler (เหมือนเดิม) ---
cron.schedule('0 8 * * *', async () => { /* ... โค้ดเดิม ... */ });
console.log('Scheduled task for low stock notification is set to run daily at 8:00 AM Bangkok time.');


// --- เริ่ม Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});