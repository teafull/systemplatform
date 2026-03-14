const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDatabase } = require('./config/database');
const redisClient = require('./config/redis');
const authRoutes = require('./routes/auth.routes');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'auth-center'
  });
});

// API路由
app.use('/api/auth', authRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '内部服务器错误'
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('Database initialized');

    // 连接Redis
    await redisClient.connect();
    console.log('Redis connected');

    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`Auth Center server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

startServer();
