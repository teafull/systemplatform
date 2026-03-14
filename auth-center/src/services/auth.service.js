const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwtService = require('./jwt.service');
const redisClient = require('../config/redis');

class AuthService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 用户登录
   */
  async login(username, password, sessionInfo = {}) {
    const client = await this.db.connect();
    try {
      // 查询用户
      const result = await client.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1 AND status = $2',
        [username, 'active']
      );

      if (result.rows.length === 0) {
        throw new Error('用户不存在或已被禁用');
      }

      const user = result.rows[0];

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('密码错误');
      }

      // 生成令牌
      const tokenPair = jwtService.generateTokenPair(user);

      // 保存会话信息到Redis
      const sessionId = uuidv4();
      const sessionData = {
        userId: user.id,
        username: user.username,
        email: user.email,
        sessionId,
        createdAt: new Date().toISOString()
      };
      await redisClient.set(
        `session:${sessionId}`,
        sessionData,
        3600 // 1小时
      );

      // 记录会话到数据库
      await client.query(
        `INSERT INTO user_sessions (user_id, session_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [user.id, sessionId, sessionInfo.ip, sessionInfo.userAgent]
      );

      // 更新最后登录时间
      await client.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      return {
        user: this.sanitizeUser(user),
        tokens: tokenPair,
        sessionId
      };
    } finally {
      client.release();
    }
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken) {
    const decoded = jwtService.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('无效的刷新令牌');
    }

    const client = await this.db.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1 AND status = $2',
        [decoded.userId, 'active']
      );

      if (result.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const user = result.rows[0];

      // 删除旧的刷新令牌
      await client.query(
        'DELETE FROM refresh_tokens WHERE token = $1',
        [refreshToken]
      );

      // 生成新令牌
      const tokenPair = jwtService.generateTokenPair(user);

      // 保存新的刷新令牌
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7天过期

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenPair.refreshToken, expiresAt]
      );

      return tokenPair;
    } finally {
      client.release();
    }
  }

  /**
   * 用户登出
   */
  async logout(sessionId) {
    // 删除Redis会话
    await redisClient.del(`session:${sessionId}`);

    return { success: true };
  }

  /**
   * 全局登出（所有设备）
   */
  async logoutAll(userId) {
    const client = await this.db.connect();
    try {
      // 删除数据库中的所有会话
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

      // 删除所有刷新令牌
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

      return { success: true };
    } finally {
      client.release();
    }
  }

  /**
   * 验证令牌
   */
  async verifyToken(token) {
    const decoded = jwtService.verifyAccessToken(token);
    if (!decoded) {
      return null;
    }

    const client = await this.db.connect();
    try {
      const result = await client.query(
        'SELECT id, username, email, display_name, avatar_url, status FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户权限
   */
  async getUserPermissions(userId) {
    const client = await this.db.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT p.code, p.name, p.resource, p.action
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
      `, [userId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * 清理用户信息（移除敏感字段）
   */
  sanitizeUser(user) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * 注册新用户
   */
  async register(userData) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 检查用户名是否已存在
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('用户名或邮箱已存在');
      }

      // 加密密码
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // 创建用户
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          userData.username,
          userData.email,
          passwordHash,
          userData.displayName || userData.username
        ]
      );

      await client.query('COMMIT');

      return this.sanitizeUser(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = AuthService;
