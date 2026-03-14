const jwtService = require('../services/jwt.service');
const redisClient = require('../config/redis');

/**
 * 认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.replace('Bearer ', '');

    // 验证token
    const decoded = jwtService.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: '令牌无效或已过期' });
    }

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: '认证失败', details: error.message });
  }
};

/**
 * 会话验证中间件
 */
const validateSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({ error: '未提供会话ID' });
    }

    // 从Redis获取会话信息
    const session = await redisClient.get(`session:${sessionId}`);
    if (!session) {
      return res.status(401).json({ error: '会话已过期' });
    }

    req.session = session;
    next();
  } catch (error) {
    res.status(401).json({ error: '会话验证失败', details: error.message });
  }
};

/**
 * 权限验证中间件工厂
 */
const authorize = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      // 这里可以从数据库或缓存中获取用户权限
      // 为简化示例，这里假设用户权限已在req.user中
      const userPermissions = req.user.permissions || [];

      // 检查是否拥有所需权限
      const hasPermission = requiredPermissions.every(perm =>
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: '权限不足',
          required: requiredPermissions
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: '权限验证失败' });
    }
  };
};

/**
 * 可选认证中间件（不强制登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwtService.verifyAccessToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    // 不做任何处理，继续请求
    next();
  }
};

module.exports = {
  authenticate,
  validateSession,
  authorize,
  optionalAuth
};
