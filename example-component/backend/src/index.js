const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routes/user.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());

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
    service: 'example-component-backend'
  });
});

// API路由
app.use('/api/users', userRoutes);

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
app.listen(PORT, () => {
  console.log(`Example Component Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
