class ComponentRegistryService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 注册新组件
   */
  async registerComponent(componentData) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 检查组件名称和路由路径是否已存在
      const existing = await client.query(
        'SELECT id FROM components WHERE name = $1 OR route_path = $2',
        [componentData.name, componentData.routePath]
      );

      if (existing.rows.length > 0) {
        throw new Error('组件名称或路由路径已存在');
      }

      // 插入组件
      const result = await client.query(
        `INSERT INTO components
         (name, display_name, description, version, frontend_url, backend_url,
          route_path, icon, category, permissions, author, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          componentData.name,
          componentData.displayName,
          componentData.description,
          componentData.version || '1.0.0',
          componentData.frontendUrl,
          componentData.backendUrl,
          componentData.routePath,
          componentData.icon,
          componentData.category || 'general',
          componentData.permissions || [],
          componentData.author,
          componentData.config || {}
        ]
      );

      const component = result.rows[0];

      // 创建初始版本记录
      await client.query(
        `INSERT INTO component_versions
         (component_id, version, frontend_url, backend_url, changelog)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          component.id,
          componentData.version || '1.0.0',
          componentData.frontendUrl,
          componentData.backendUrl,
          '初始版本'
        ]
      );

      // 处理依赖关系
      if (componentData.dependencies && componentData.dependencies.length > 0) {
        for (const dep of componentData.dependencies) {
          await client.query(
            `INSERT INTO component_dependencies
             (component_id, dependency_id, version_requirement)
             VALUES ($1, (SELECT id FROM components WHERE name = $2), $3)`,
            [component.id, dep.name, dep.version]
          );
        }
      }

      await client.query('COMMIT');
      return component;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新组件
   */
  async updateComponent(id, updateData) {
    const client = await this.db.connect();
    try {
      const sets = [];
      const values = [];
      let paramIndex = 1;

      const fields = [
        'displayName', 'description', 'version', 'frontendUrl',
        'backendUrl', 'icon', 'category', 'permissions', 'enabled', 'config'
      ];

      for (const field of fields) {
        if (updateData[field] !== undefined) {
          sets.push(`${this.camelToSnake(field)} = $${paramIndex}`);
          values.push(updateData[field]);
          paramIndex++;
        }
      }

      if (sets.length === 0) {
        throw new Error('没有要更新的字段');
      }

      sets.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE components
        SET ${sets.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除组件
   */
  async deleteComponent(id) {
    const client = await this.db.connect();
    try {
      // 检查是否有其他组件依赖此组件
      const dependencies = await client.query(
        'SELECT COUNT(*) FROM component_dependencies WHERE dependency_id = $1',
        [id]
      );

      if (parseInt(dependencies.rows[0].count) > 0) {
        throw new Error('该组件正在被其他组件依赖，无法删除');
      }

      const result = await client.query(
        'DELETE FROM components WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取所有启用的组件
   */
  async getEnabledComponents() {
    const result = await this.db.query(`
      SELECT
        c.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'name', (SELECT name FROM components WHERE id = cd.dependency_id),
            'versionRequirement', cd.version_requirement
          )) FILTER (WHERE cd.dependency_id IS NOT NULL),
          '[]'
        ) as dependencies
      FROM components c
      LEFT JOIN component_dependencies cd ON c.id = cd.component_id
      WHERE c.enabled = true AND c.status = 'active'
      GROUP BY c.id
      ORDER BY c.display_name
    `);

    return result.rows;
  }

  /**
   * 获取所有组件
   */
  async getAllComponents(filters = {}) {
    let query = `
      SELECT
        c.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'name', (SELECT name FROM components WHERE id = cd.dependency_id),
            'versionRequirement', cd.version_requirement
          )) FILTER (WHERE cd.dependency_id IS NOT NULL),
          '[]'
        ) as dependencies
      FROM components c
      LEFT JOIN component_dependencies cd ON c.id = cd.component_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.category) {
      query += ` AND c.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.enabled !== undefined) {
      query += ` AND c.enabled = $${paramIndex}`;
      params.push(filters.enabled);
      paramIndex++;
    }

    query += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * 根据ID获取组件
   */
  async getComponentById(id) {
    const result = await this.db.query(
      'SELECT * FROM components WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // 获取依赖关系
    const deps = await this.db.query(`
      SELECT
        (SELECT name FROM components WHERE id = cd.dependency_id) as name,
        cd.version_requirement as versionRequirement
      FROM component_dependencies cd
      WHERE cd.component_id = $1
    `, [id]);

    const component = result.rows[0];
    component.dependencies = deps.rows;

    return component;
  }

  /**
   * 根据名称获取组件
   */
  async getComponentByName(name) {
    const result = await this.db.query(
      'SELECT * FROM components WHERE name = $1',
      [name]
    );

    return result.rows[0] || null;
  }

  /**
   * 启用/禁用组件
   */
  async toggleComponentStatus(id, enabled) {
    const result = await this.db.query(
      'UPDATE components SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [enabled, id]
    );

    return result.rows[0];
  }

  /**
   * 创建新版本
   */
  async createVersion(componentId, versionData) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 检查版本是否已存在
      const existing = await client.query(
        'SELECT id FROM component_versions WHERE component_id = $1 AND version = $2',
        [componentId, versionData.version]
      );

      if (existing.rows.length > 0) {
        throw new Error('该版本已存在');
      }

      // 插入新版本
      const result = await client.query(
        `INSERT INTO component_versions
         (component_id, version, frontend_url, backend_url, changelog)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          componentId,
          versionData.version,
          versionData.frontendUrl,
          versionData.backendUrl,
          versionData.changelog
        ]
      );

      // 更新组件的当前版本和URL
      await client.query(
        `UPDATE components
         SET version = $1,
             frontend_url = $2,
             backend_url = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [
          versionData.version,
          versionData.frontendUrl,
          versionData.backendUrl,
          componentId
        ]
      );

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
   * 记录组件使用
   */
  async recordUsage(componentId, userId, sessionId) {
    await this.db.query(
      `INSERT INTO component_usage (component_id, user_id, session_id)
       VALUES ($1, $2, $3)`,
      [componentId, userId, sessionId]
    );
  }

  /**
   * 驼峰转下划线
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = ComponentRegistryService;
