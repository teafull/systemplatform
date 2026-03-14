/**
 * 授权中心初始化脚本
 * 创建默认角色和权限
 */

const { pool } = require('../config/database');
const casbinService = require('../services/casbin.service');

async function init() {
  console.log('开始初始化授权中心...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 创建默认角色
    console.log('创建默认角色...');

    const roles = [
      {
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有系统所有权限',
        type: 'system',
        is_system: true,
        level: 100
      },
      {
        code: 'admin',
        name: '管理员',
        description: '拥有管理权限',
        type: 'system',
        is_system: true,
        level: 50
      },
      {
        code: 'user',
        name: '普通用户',
        description: '基础用户权限',
        type: 'system',
        is_system: true,
        level: 10
      },
      {
        code: 'guest',
        name: '访客',
        description: '只读权限',
        type: 'system',
        is_system: true,
        level: 1
      }
    ];

    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (code, name, description, type, is_system, level)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [role.code, role.name, role.description, role.type, role.is_system, role.level]
      );
      console.log(`  ✓ 创建角色: ${role.name}`);
    }

    // 2. 创建默认动作
    console.log('\n创建默认动作...');

    const actions = [
      { code: 'read', name: '读取', description: '读取资源', category: 'basic' },
      { code: 'write', name: '写入', description: '写入资源', category: 'basic' },
      { code: 'delete', name: '删除', description: '删除资源', category: 'danger' },
      { code: 'admin', name: '管理', description: '管理权限', category: 'danger' },
      { code: 'create', name: '创建', description: '创建资源', category: 'basic' },
      { code: 'update', name: '更新', description: '更新资源', category: 'basic' },
      { code: 'export', name: '导出', description: '导出数据', category: 'advanced' },
      { code: 'import', name: '导入', description: '导入数据', category: 'advanced' },
      { code: 'audit', name: '审计', description: '审计日志', category: 'advanced' },
      { code: 'config', name: '配置', description: '系统配置', category: 'danger' }
    ];

    for (const action of actions) {
      await client.query(
        `INSERT INTO actions (code, name, description, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [action.code, action.name, action.description, action.category]
      );
      console.log(`  ✓ 创建动作: ${action.name}`);
    }

    // 3. 创建系统资源
    console.log('\n创建系统资源...');

    const resources = [
      { type: 'system', identifier: '*', name: '系统资源', description: '所有系统资源' },
      { type: 'component', identifier: '*', name: '组件资源', description: '所有组件' },
      { type: 'user', identifier: '*', name: '用户资源', description: '所有用户' },
      { type: 'role', identifier: '*', name: '角色资源', description: '所有角色' },
      { type: 'permission', identifier: '*', name: '权限资源', description: '所有权限' }
    ];

    const createdResources = {};
    for (const resource of resources) {
      const result = await client.query(
        `INSERT INTO resources (type, identifier, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (type, identifier) DO NOTHING
         RETURNING id`,
        [resource.type, resource.identifier, resource.name, resource.description]
      );
      if (result.rows.length > 0) {
        createdResources[resource.type] = result.rows[0].id;
      }
      console.log(`  ✓ 创建资源: ${resource.name}`);
    }

    // 4. 创建默认权限
    console.log('\n创建默认权限...');

    // 获取所有动作
    const actionsResult = await client.query('SELECT id, code FROM actions');
    const actionMap = {};
    actionsResult.rows.forEach(row => {
      actionMap[row.code] = row.id;
    });

    // 创建系统资源权限
    const systemResourceId = createdResources['system'];
    for (const action of ['read', 'write', 'delete', 'admin']) {
      const actionId = actionMap[action];
      if (systemResourceId && actionId) {
        await client.query(
          `INSERT INTO permissions (resource_id, action_id, code, name, description, level)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            systemResourceId,
            actionId,
            `system:${action}`,
            `系统${action === 'read' ? '读取' : action === 'write' ? '写入' : action === 'delete' ? '删除' : '管理'}权限`,
            `系统的${action}权限`,
            action === 'admin' ? 'admin' : 'standard'
          ]
        );
      }
    }

    // 5. 配置超级管理员权限
    console.log('\n配置超级管理员权限...');

    await casbinService.init();

    // 超级管理员拥有所有权限
    await casbinService.addPolicy('super_admin', '*', '*', 'allow');
    console.log('  ✓ 超级管理员权限配置完成');

    // 6. 输出初始化完成信息
    console.log('\n' + '='.repeat(50));
    console.log('授权中心初始化完成！');
    console.log('='.repeat(50));
    console.log('\n默认角色:');
    console.log('  - super_admin: 超级管理员 (权限级别: 100)');
    console.log('  - admin: 管理员 (权限级别: 50)');
    console.log('  - user: 普通用户 (权限级别: 10)');
    console.log('  - guest: 访客 (权限级别: 1)');
    console.log('\n使用说明:');
    console.log('  1. 通过API授予用户角色:');
    console.log('     POST /api/authz/roles/grant');
    console.log('  2. 授予组件访问权限:');
    console.log('     POST /api/authz/components/grant');
    console.log('\n' + '='.repeat(50));

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 运行初始化
init().catch(error => {
  console.error('初始化错误:', error);
  process.exit(1);
});
