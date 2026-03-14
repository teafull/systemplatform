const express = require('express');
const router = express.Router();
const AuthService = require('../services/auth.service');
const { pool } = require('../config/database');
const { authenticate, validateSession } = require('../middleware/auth.middleware');

const authService = new AuthService(pool);

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const sessionInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await authService.login(username, password, sessionInfo);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码不能为空' });
    }

    const user = await authService.register({
      username,
      email,
      password,
      displayName
    });

    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 刷新令牌
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: '刷新令牌不能为空' });
    }

    const tokens = await authService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    await authService.logout(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 全局登出
 * POST /api/auth/logout-all
 */
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    await authService.logoutAll(req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.verifyToken(req.headers.authorization.replace('Bearer ', ''));
    const permissions = await authService.getUserPermissions(req.user.userId);

    res.json({
      user,
      permissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 验证令牌
 * POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: '令牌不能为空' });
    }

    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({ valid: false });
    }

    res.json({ valid: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
