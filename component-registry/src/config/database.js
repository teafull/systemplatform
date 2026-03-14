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

    // 组件表
    await client.query(`
      CREATE TABLE IF NOT EXISTS components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        version VARCHAR(20) DEFAULT '1.0.0',
        frontend_url VARCHAR(500),
        backend_url VARCHAR(500),
        route_path VARCHAR(200) UNIQUE NOT NULL,
        icon VARCHAR(500),
        category VARCHAR(50) DEFAULT 'general',
        permissions TEXT[] DEFAULT '{}',
        enabled BOOLEAN DEFAULT true,
        status VARCHAR(20) DEFAULT 'active',
        config JSONB DEFAULT '{}',
        dependencies TEXT[] DEFAULT '{}',
        author VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 组件版本表
    await client.query(`
      CREATE TABLE IF NOT EXISTS component_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        version VARCHAR(20) NOT NULL,
        changelog TEXT,
        frontend_url VARCHAR(500),
        backend_url VARCHAR(500),
        released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(component_id, version)
      )
    `);

    // 组件依赖表
    await client.query(`
      CREATE TABLE IF NOT EXISTS component_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        dependency_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        version_requirement VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(component_id, dependency_id)
      )
    `);

    // 组件使用记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS component_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        session_id VARCHAR(255),
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0
      )
    `);

    await client.query('COMMIT');
    console.log('Component registry database tables initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
