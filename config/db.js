const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST, // อ่านค่า DB_HOST จากไฟล์ .env
    user: process.env.DB_USER, // อ่านค่า DB_USER จากไฟล์ .env
    password: process.env.DB_PASSWORD, // อ่านค่า DB_PASSWORD จากไฟล์ .env
    database: process.env.DB_NAME, // อ่านค่า DB_NAME จากไฟล์ .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connected successfully!');
        connection.release();
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
}

testConnection();

module.exports = pool;