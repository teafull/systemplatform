const { newEnforcer } = require('casbin');
const { PostgresAdapter } = require('casbin-pg-adapter');
const { pool } = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

class CasbinService {
  constructor() {
    this.enforcer = null;
    this.adapter = null;
  }

  /**
   * 初始化Casbin
   */
  async init() {
    try {
      // 创建PostgreSQL适配器
      this.adapter = await PostgresAdapter.newAdapter({
        connectionString: process.env.DB_CONNECTION_STRING ||
          `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
      });

      // 创建执行器（使用RBAC模型）
      this.enforcer = await newEnforcer(
        this.getModelPath(),
        this.adapter
      );

      console.log('Casbin initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Casbin:', error);
      throw error;
    }
  }

  /**
   * 获取模型文件路径
   */
  getModelPath() {
    // 返回内联模型配置
    return `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act, eft

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch2(r.obj, p.obj) && r.act == p.act
    `;
  }

  /**
   * 添加策略
   */
  async addPolicy(subject, object, action, effect = 'allow') {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.addPolicy(subject, object, action, effect);
  }

  /**
   * 批量添加策略
   */
  async addPolicies(policies) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.addPolicies(policies);
  }

  /**
   * 删除策略
   */
  async removePolicy(subject, object, action) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.removePolicy(subject, object, action);
  }

  /**
   * 检查权限
   */
  async enforce(subject, object, action) {
    if (!this.enforcer) {
      await this.init();
    }

    // 首先检查是否是超级管理员
    const isAdmin = await this.checkIsAdmin(subject);
    if (isAdmin) {
      return true;
    }

    return await this.enforcer.enforce(subject, object, action);
  }

  /**
   * 批量检查权限
   */
  async enforceBatch(enforceData) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.batchEnforce(enforceData);
  }

  /**
   * 获取用户的所有策略
   */
  async getPoliciesForUser(subject) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.getFilteredPolicy(0, subject);
  }

  /**
   * 获取资源的所有策略
   */
  async getPoliciesForResource(object) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.getFilteredPolicy(1, object);
  }

  /**
   * 检查用户是否是管理员
   */
  async checkIsAdmin(subject) {
    const client = pool.connect();
    try {
      const result = await (await client).query(`
        SELECT EXISTS (
          SELECT 1 FROM user_roles ur
          INNER JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1 AND r.code = 'admin'
        )
      `, [subject]);

      return result.rows[0].exists;
    } catch (error) {
      console.error('Check admin error:', error);
      return false;
    } finally {
      (await client).release();
    }
  }

  /**
   * 删除用户的所有策略
   */
  async removePoliciesForUser(subject) {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.deleteRolesForUser(subject);
  }

  /**
   * 刷新策略缓存
   */
  async loadPolicy() {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.loadPolicy();
  }

  /**
   * 保存策略
   */
  async savePolicy() {
    if (!this.enforcer) {
      await this.init();
    }
    return await this.enforcer.savePolicy();
  }
}

module.exports = new CasbinService();
