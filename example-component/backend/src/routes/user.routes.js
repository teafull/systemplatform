const express = require('express');
const router = express.Router();
const axios = require('axios');

// 认证服务地址
const AUTH_SERVICE_URL = 'http://localhost:4000';

/**
 * 认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.replace('Bearer ', '');

    // 向认证中心验证令牌
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/auth/verify`,
      { token }
    );

    if (!response.data.valid) {
      return res.status(401).json({ error: '令牌无效' });
    }

    req.user = response.data.user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: '认证失败' });
  }
};

// 模拟用户数据
const mockUsers = [
  {
    id: '1',
    name: '张三',
    email: 'zhangsan@example.com',
    role: '管理员',
    status: '活跃',
    createdAt: '2024-01-01 10:00:00'
  },
  {
    id: '2',
    name: '李四',
    email: 'lisi@example.com',
    role: '用户',
    status: '活跃',
    createdAt: '2024-01-02 11:00:00'
  },
  {
    id: '3',
    name: '王五',
    email: 'wangwu@example.com',
    role: '用户',
    status: '禁用',
    createdAt: '2024-01-03 12:00:00'
  }
];

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    users: mockUsers,
    total: mockUsers.length
  });
});

/**
 * 根据ID获取用户
 * GET /api/users/:id
 */
router.get('/:id', authenticate, (req, res) => {
  const user = mockUsers.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user });
});

/**
 * 创建用户
 * POST /api/users
 */
router.post('/', authenticate, (req, res) => {
  const newUser = {
    id: String(mockUsers.length + 1),
    ...req.body,
    createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  mockUsers.push(newUser);
  res.status(201).json({ user: newUser });
});

/**
 * 更新用户
 * PUT /api/users/:id
 */
router.put('/:id', authenticate, (req, res) => {
  const index = mockUsers.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  mockUsers[index] = { ...mockUsers[index], ...req.body };
  res.json({ user: mockUsers[index] });
});

/**
 * 删除用户
 * DELETE /api/users/:id
 */
router.delete('/:id', authenticate, (req, res) => {
  const index = mockUsers.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  mockUsers.splice(index, 1);
  res.json({ success: true });
});

module.exports = router;
