const express = require('express');
const router = express.Router();
const authorizationService = require('../services/authorization.service');
const casbinService = require('../services/casbin.service');
const { pool } = require('../config/database');

/**
 * 检查组件访问权限
 * POST /api/authz/check-component
 */
router.post('/check-component', async (req, res) => {
  try {
    const { token, componentId, requiredLevel } = req.body;

    if (!token || !componentId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const user = await authorizationService.validateTokenAndGetUser(token);
    const result = await authorizationService.checkComponentAccess(
      user.id,
      componentId,
      requiredLevel || 'read'
    );

    res.json({ userId: user.id, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 批量检查组件访问权限
 * POST /api/authz/batch-check-component
 */
router.post('/batch-check-component', async (req, res) => {
  try {
    const { token, componentIds } = req.body;

    if (!token || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const user = await authorizationService.validateTokenAndGetUser(token);
    const results = await authorizationService.batchCheckComponentAccess(
      user.id,
      componentIds
    );

    res.json({ userId: user.id, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 检查资源权限
 * POST /api/authz/check-resource
 */
router.post('/check-resource', async (req, res) => {
  try {
    const { token, resourceType, resourceId, action } = req.body;

    if (!token || !resourceType || !resourceId || !action) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const user = await authorizationService.validateTokenAndGetUser(token);
    const result = await authorizationService.checkResourcePermission(
      user.id,
      resourceType,
      resourceId,
      action
    );

    res.json({ userId: user.id, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 授予用户角色
 * POST /api/authz/roles/grant
 */
router.post('/roles/grant', async (req, res) => {
  try {
    const { userId, roleId, tenantId, expiresAt } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await authorizationService.grantRoleToUser(
      userId,
      roleId,
      tenantId,
      expiresAt
    );

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 撤销用户角色
 * POST /api/authz/roles/revoke
 */
router.post('/roles/revoke', async (req, res) => {
  try {
    const { userId, roleId, tenantId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await authorizationService.revokeRoleFromUser(
      userId,
      roleId,
      tenantId
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 授予组件访问权限
 * POST /api/authz/components/grant
 */
router.post('/components/grant', async (req, res) => {
  try {
    const { componentId, subjectType, subjectId, accessLevel, expiresAt } = req.body;

    if (!componentId || !subjectType || !subjectId || !accessLevel) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await authorizationService.grantComponentAccess(
      componentId,
      subjectType,
      subjectId,
      accessLevel,
      expiresAt
    );

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 撤销组件访问权限
 * POST /api/authz/components/revoke
 */
router.post('/components/revoke', async (req, res) => {
  try {
    const { componentId, subjectType, subjectId } = req.body;

    if (!componentId || !subjectType || !subjectId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await authorizationService.revokeComponentAccess(
      componentId,
      subjectType,
      subjectId
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取用户的所有组件访问权限
 * GET /api/authz/users/:userId/components
 */
router.get('/users/:userId/components', async (req, res) => {
  try {
    const { userId } = req.params;
    const components = await authorizationService.getUserComponentAccess(userId);
    res.json({ components });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 添加Casbin策略
 * POST /api/authz/policies
 */
router.post('/policies', async (req, res) => {
  try {
    const { policies } = req.body;

    if (!Array.isArray(policies)) {
      return res.status(400).json({ error: 'policies必须是数组' });
    }

    const results = [];
    for (const policy of policies) {
      const { subject, object, action, effect } = policy;
      const result = await casbinService.addPolicy(subject, object, action, effect);
      results.push(result);
    }

    res.status(201).json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除Casbin策略
 * DELETE /api/authz/policies
 */
router.delete('/policies', async (req, res) => {
  try {
    const { subject, object, action } = req.query;

    if (!subject || !object || !action) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await casbinService.removePolicy(subject, object, action);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取用户的所有策略
 * GET /api/authz/policies/:userId
 */
router.get('/policies/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const policies = await casbinService.getPoliciesForUser(userId);
    res.json({ policies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有角色
 * GET /api/authz/roles
 */
router.get('/roles', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT * FROM roles ORDER BY level DESC, created_at ASC
    `);
    client.release();

    res.json({ roles: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建角色
 * POST /api/authz/roles
 */
router.post('/roles', async (req, res) => {
  try {
    const { code, name, description, type, level } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: '角色代码和名称不能为空' });
    }

    const client = await pool.connect();
    const result = await client.query(`
      INSERT INTO roles (code, name, description, type, level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [code, name, description, type || 'custom', level || 1]);
    client.release();

    res.status(201).json({ role: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
