const express = require('express');
const router = express.Router();
const ComponentRegistryService = require('../services/registry.service');
const { pool } = require('../config/database');
const { authenticate } = require('../../auth-center/src/middleware/auth.middleware');

const registryService = new ComponentRegistryService(pool);

/**
 * 获取所有启用的组件
 * GET /api/registry/components
 */
router.get('/components', async (req, res) => {
  try {
    const components = await registryService.getEnabledComponents();
    res.json({ components });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有组件（包含禁用的）
 * GET /api/registry/components/all
 */
router.get('/components/all', authenticate, async (req, res) => {
  try {
    const { category, status, enabled } = req.query;
    const components = await registryService.getAllComponents({
      category,
      status,
      enabled: enabled !== undefined ? enabled === 'true' : undefined
    });
    res.json({ components });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 根据ID获取组件
 * GET /api/registry/components/:id
 */
router.get('/components/:id', async (req, res) => {
  try {
    const component = await registryService.getComponentById(req.params.id);
    if (!component) {
      return res.status(404).json({ error: '组件不存在' });
    }
    res.json({ component });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 根据名称获取组件
 * GET /api/registry/components/name/:name
 */
router.get('/components/name/:name', async (req, res) => {
  try {
    const component = await registryService.getComponentByName(req.params.name);
    if (!component) {
      return res.status(404).json({ error: '组件不存在' });
    }
    res.json({ component });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 注册新组件
 * POST /api/registry/components
 */
router.post('/components', authenticate, async (req, res) => {
  try {
    const component = await registryService.registerComponent(req.body);
    res.status(201).json({ component });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 更新组件
 * PUT /api/registry/components/:id
 */
router.put('/components/:id', authenticate, async (req, res) => {
  try {
    const component = await registryService.updateComponent(req.params.id, req.body);
    res.json({ component });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 删除组件
 * DELETE /api/registry/components/:id
 */
router.delete('/components/:id', authenticate, async (req, res) => {
  try {
    const component = await registryService.deleteComponent(req.params.id);
    res.json({ component });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 启用/禁用组件
 * PATCH /api/registry/components/:id/toggle
 */
router.patch('/components/:id/toggle', authenticate, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled字段必须是布尔值' });
    }
    const component = await registryService.toggleComponentStatus(req.params.id, enabled);
    res.json({ component });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建组件新版本
 * POST /api/registry/components/:id/versions
 */
router.post('/components/:id/versions', authenticate, async (req, res) => {
  try {
    const version = await registryService.createVersion(req.params.id, req.body);
    res.status(201).json({ version });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 记录组件使用
 * POST /api/registry/components/:id/usage
 */
router.post('/components/:id/usage', async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    await registryService.recordUsage(req.params.id, userId, sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
