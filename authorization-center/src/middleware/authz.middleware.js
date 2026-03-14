const authorizationService = require('../services/authorization.service');

/**
 * 授权中间件工厂函数
 * @param {Object} options - 配置选项
 * @param {string} options.componentId - 组件ID
 * @param {string} options.requiredLevel - 所需访问级别 (read|write|admin)
 * @param {boolean} options.checkResource - 是否检查资源权限
 * @param {string} options.resourceType - 资源类型
 * @param {Function} options.getResourceId - 获取资源ID的函数
 */
const authorize = (options = {}) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
      }

      // 验证Token并获取用户信息
      const user = await authorizationService.validateTokenAndGetUser(token);
      req.user = user;

      // 如果指定了组件ID，检查组件访问权限
      if (options.componentId) {
        const componentAuth = await authorizationService.checkComponentAccess(
          user.id,
          options.componentId,
          options.requiredLevel || 'read'
        );

        if (!componentAuth.allowed) {
          return res.status(403).json({
            error: '无组件访问权限',
            reason: componentAuth.reason,
            requiredLevel: options.requiredLevel || 'read'
          });
        }

        req.componentAccess = componentAuth;
      }

      // 如果需要检查资源权限
      if (options.checkResource) {
        const resourceId = options.getResourceId
          ? options.getResourceId(req)
          : req.params.id || req.params.resourceId;

        if (!resourceId) {
          return res.status(400).json({ error: '无法确定资源ID' });
        }

        const resourceAuth = await authorizationService.checkResourcePermission(
          user.id,
          options.resourceType || 'resource',
          resourceId,
          req.method.toLowerCase()
        );

        if (!resourceAuth.allowed) {
          return res.status(403).json({
            error: '无资源操作权限',
            resourceType: options.resourceType,
            resourceId,
            action: req.method.toLowerCase()
          });
        }

        req.resourceAccess = resourceAuth;
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({ error: '授权检查失败' });
    }
  };
};

/**
 * 组件级授权中间件
 * 从请求中提取组件ID并进行授权检查
 */
const componentAuthorize = (requiredLevel = 'read') => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization;
      const componentId = req.headers['x-component-id'] || req.params.componentId;

      if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
      }

      if (!componentId) {
        return res.status(400).json({ error: '未指定组件ID' });
      }

      const user = await authorizationService.validateTokenAndGetUser(token);
      req.user = user;

      const componentAuth = await authorizationService.checkComponentAccess(
        user.id,
        componentId,
        requiredLevel
      );

      if (!componentAuth.allowed) {
        return res.status(403).json({
          error: '无组件访问权限',
          reason: componentAuth.reason,
          requiredLevel
        });
      }

      req.componentAccess = componentAuth;
      next();
    } catch (error) {
      console.error('Component authorization error:', error);
      res.status(500).json({ error: '授权检查失败' });
    }
  };
};

/**
 * 资源级授权中间件
 */
const resourceAuthorize = (resourceType, action) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization;
      const resourceId = req.params.id || req.params.resourceId;

      if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
      }

      if (!resourceId) {
        return res.status(400).json({ error: '无法确定资源ID' });
      }

      const user = await authorizationService.validateTokenAndGetUser(token);
      req.user = user;

      const resourceAuth = await authorizationService.checkResourcePermission(
        user.id,
        resourceType,
        resourceId,
        action
      );

      if (!resourceAuth.allowed) {
        return res.status(403).json({
          error: '无资源操作权限',
          resourceType,
          resourceId,
          action
        });
      }

      req.resourceAccess = resourceAuth;
      next();
    } catch (error) {
      console.error('Resource authorization error:', error);
      res.status(500).json({ error: '授权检查失败' });
    }
  };
};

/**
 * 可选授权中间件（不强制授权，但会设置权限信息）
 */
const optionalAuthorize = async (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (token) {
      try {
        const user = await authorizationService.validateTokenAndGetUser(token);
        req.user = user;

        const componentId = req.headers['x-component-id'];
        if (componentId) {
          const componentAuth = await authorizationService.checkComponentAccess(
            user.id,
            componentId,
            'read'
          );
          req.componentAccess = componentAuth;
        }
      } catch (error) {
        // 忽略错误，继续处理请求
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authorize,
  componentAuthorize,
  resourceAuthorize,
  optionalAuthorize
};
