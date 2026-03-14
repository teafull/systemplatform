const { pool } = require('../config/database');
const casbinService = require('./casbin.service');
const axios = require('axios');

class AuthorizationService {
  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
  }

  /**
   * 验证Token并获取用户信息
   */
  async validateTokenAndGetUser(token) {
    try {
      const response = await axios.post(
        `${this.authServiceUrl}/api/auth/verify`,
        { token: token.replace('Bearer ', '') }
      );

      if (!response.data.valid) {
        throw new Error('Token无效');
      }

      return response.data.user;
    } catch (error) {
      throw new Error('Token验证失败');
    }
  }

  /**
   * 检查用户是否有访问组件的权限
   */
  async checkComponentAccess(userId, componentId, requiredLevel = 'read') {
    const client = await pool.connect();
    try {
      // 检查是否是超级管理员
      const isAdmin = await casbinService.checkIsAdmin(userId);
      if (isAdmin) {
        return { allowed: true, level: 'admin' };
      }

      // 获取用户的角色
      const userRolesResult = await client.query(`
        SELECT r.id, r.code, r.level
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
      `, [userId]);

      const userRoles = userRolesResult.rows;

      if (userRoles.length === 0) {
        return { allowed: false, reason: '用户无角色' };
      }

      // 检查角色级别的组件授权
      for (const role of userRoles) {
        const authResult = await this.checkRoleComponentAccess(role.id, componentId, requiredLevel);
        if (authResult.allowed) {
          return authResult;
        }
      }

      // 检查用户级别的组件授权
      const userAuthResult = await this.checkUserComponentAccess(userId, componentId, requiredLevel);
      if (userAuthResult.allowed) {
        return userAuthResult;
      }

      return { allowed: false, reason: '无组件访问权限' };
    } finally {
      client.release();
    }
  }

  /**
   * 检查角色的组件访问权限
   */
  async checkRoleComponentAccess(roleId, componentId, requiredLevel) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT access_level, conditions
        FROM component_authorizations
        WHERE component_id = $1
          AND subject_type = 'role'
          AND subject_id = $2
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, [componentId, roleId]);

      if (result.rows.length === 0) {
        return { allowed: false };
      }

      const auth = result.rows[0];
      const accessLevels = { none: 0, read: 1, write: 2, admin: 3 };

      if (accessLevels[auth.access_level] >= accessLevels[requiredLevel]) {
        return { allowed: true, level: auth.access_level, conditions: auth.conditions };
      }

      return { allowed: false };
    } finally {
      client.release();
    }
  }

  /**
   * 检查用户的组件访问权限
   */
  async checkUserComponentAccess(userId, componentId, requiredLevel) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT access_level, conditions
        FROM component_authorizations
        WHERE component_id = $1
          AND subject_type = 'user'
          AND subject_id = $2
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, [componentId, userId]);

      if (result.rows.length === 0) {
        return { allowed: false };
      }

      const auth = result.rows[0];
      const accessLevels = { none: 0, read: 1, write: 2, admin: 3 };

      if (accessLevels[auth.access_level] >= accessLevels[requiredLevel]) {
        return { allowed: true, level: auth.access_level, conditions: auth.conditions };
      }

      return { allowed: false };
    } finally {
      client.release();
    }
  }

  /**
   * 检查资源权限
   */
  async checkResourcePermission(userId, resourceType, resourceId, action) {
    const client = await pool.connect();
    try {
      // 构造资源标识符
      const resourceIdentifier = `${resourceType}:${resourceId}`;

      // 使用Casbin检查权限
      const allowed = await casbinService.enforce(userId, resourceIdentifier, action);

      return { allowed };
    } catch (error) {
      console.error('Check resource permission error:', error);
      return { allowed: false };
    } finally {
      client.release();
    }
  }

  /**
   * 授予用户角色
   */
  async grantRoleToUser(userId, roleId, tenantId = null, expiresAt = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO user_roles (user_id, role_id, tenant_id, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, role_id, tenant_id)
        DO UPDATE SET expires_at = $4
        RETURNING *
      `, [userId, roleId, tenantId, expiresAt]);

      // 同步到Casbin
      await casbinService.addPolicy(userId, '*', '*');

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 撤销用户角色
   */
  async revokeRoleFromUser(userId, roleId, tenantId = null) {
    const client = await pool.connect();
    try {
      await client.query(`
        DELETE FROM user_roles
        WHERE user_id = $1 AND role_id = $2 AND (tenant_id = $3 OR tenant_id IS NULL)
      `, [userId, roleId, tenantId]);

      // 同步到Casbin
      await casbinService.removePoliciesForUser(userId);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 授予组件访问权限
   */
  async grantComponentAccess(componentId, subjectType, subjectId, accessLevel, expiresAt = null) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO component_authorizations
        (component_id, subject_type, subject_id, access_level, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (component_id, subject_type, subject_id)
        DO UPDATE SET access_level = $4, expires_at = $5
        RETURNING *
      `, [componentId, subjectType, subjectId, accessLevel, expiresAt]);

      return result.rows[0];
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 撤销组件访问权限
   */
  async revokeComponentAccess(componentId, subjectType, subjectId) {
    const client = await pool.connect();
    try {
      await client.query(`
        DELETE FROM component_authorizations
        WHERE component_id = $1 AND subject_type = $2 AND subject_id = $3
      `, [componentId, subjectType, subjectId]);

      return { success: true };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量检查组件权限
   */
  async batchCheckComponentAccess(userId, componentIds) {
    const client = await pool.connect();
    try {
      // 获取用户角色
      const userRolesResult = await client.query(`
        SELECT r.id, r.code
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
      `, [userId]);

      const roleIds = userRolesResult.rows.map(r => r.id);

      const results = {};
      for (const componentId of componentIds) {
        // 检查用户级别权限
        const userAuthResult = await client.query(`
          SELECT access_level
          FROM component_authorizations
          WHERE component_id = $1
            AND subject_type = 'user'
            AND subject_id = $2
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [componentId, userId]);

        if (userAuthResult.rows.length > 0) {
          results[componentId] = {
            allowed: true,
            level: userAuthResult.rows[0].access_level
          };
          continue;
        }

        // 检查角色级别权限
        if (roleIds.length > 0) {
          const roleAuthResult = await client.query(`
            SELECT MAX(access_level) as max_level
            FROM component_authorizations
            WHERE component_id = $1
              AND subject_type = 'role'
              AND subject_id = ANY($2)
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          `, [componentId, roleIds]);

          if (roleAuthResult.rows[0].max_level) {
            results[componentId] = {
              allowed: true,
              level: roleAuthResult.rows[0].max_level
            };
            continue;
          }
        }

        results[componentId] = { allowed: false };
      }

      return results;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的所有组件访问权限
   */
  async getUserComponentAccess(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT
          ca.component_id,
          ca.access_level,
          ca.expires_at,
          ca.conditions,
          c.name as component_name,
          c.display_name as component_display_name,
          CASE WHEN ca.subject_type = 'user' THEN 'user' ELSE 'role' END as granted_by_type
        FROM component_authorizations ca
        INNER JOIN components c ON ca.component_id = c.id
        WHERE (ca.subject_type = 'user' AND ca.subject_id = $1)
           OR (ca.subject_type = 'role' AND ca.subject_id IN (
             SELECT role_id FROM user_roles WHERE user_id = $1
           ))
          AND (ca.expires_at IS NULL OR ca.expires_at > CURRENT_TIMESTAMP)
      `, [userId]);

      return result.rows;
    } finally {
      client.release();
    }
  }
}

module.exports = new AuthorizationService();
