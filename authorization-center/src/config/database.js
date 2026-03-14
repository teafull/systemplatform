const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
});

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 资源表（定义系统的所有资源）
    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        identifier VARCHAR(200) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id UUID REFERENCES resources(id) ON DELETE CASCADE,
        component_id UUID,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, identifier)
      )
    `);

    // 动作表（定义资源上可以执行的操作）
    await client.query(`
      CREATE TABLE IF NOT EXISTS actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 权限表（资源+动作的组合）
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        code VARCHAR(200) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        level VARCHAR(20) DEFAULT 'standard', -- standard, admin, owner
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(resource_id, action_id)
      )
    `);

    // 角色表
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(20) DEFAULT 'custom', -- system, custom
        is_system BOOLEAN DEFAULT false,
        level INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 角色权限关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        granted_by UUID,
        UNIQUE(role_id, permission_id)
      )
    `);

    // 用户角色关联表（支持租户隔离）
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        tenant_id VARCHAR(100),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        granted_by UUID,
        expires_at TIMESTAMP,
        UNIQUE(user_id, role_id, tenant_id)
      )
    `);

    // 组件授权表（控制用户/角色对组件的访问）
    await client.query(`
      CREATE TABLE IF NOT EXISTS component_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID NOT NULL,
        subject_type VARCHAR(20) NOT NULL, -- user, role
        subject_id UUID NOT NULL,
        access_level VARCHAR(20) DEFAULT 'read', -- none, read, write, admin
        conditions JSONB DEFAULT '{}',
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        granted_by UUID,
        expires_at TIMESTAMP,
        UNIQUE(component_id, subject_type, subject_id)
      )
    `);

    // 授权策略表（Casbin策略）
    await client.query(`
      CREATE TABLE IF NOT EXISTS casbin_rule (
        id SERIAL PRIMARY KEY,
        ptype VARCHAR(100) NOT NULL,
        v0 VARCHAR(100),
        v1 VARCHAR(100),
        v2 VARCHAR(100),
        v3 VARCHAR(100),
        v4 VARCHAR(100),
        v5 VARCHAR(100)
      )
    `);

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
      CREATE INDEX IF NOT EXISTS idx_component_authorizations_component_id ON component_authorizations(component_id);
      CREATE INDEX IF NOT EXISTS idx_casbin_rule_ptype ON casbin_rule(ptype);
    `);

    await client.query('COMMIT');
    console.log('Authorization center database tables initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
