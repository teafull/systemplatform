# 授权中心

负责平台的统一权限管理和授权控制。

## 功能特性

- **RBAC权限模型** - 基于角色的访问控制
- **组件级授权** - 控制用户对组件的访问权限
- **资源级授权** - 细粒度的资源操作权限控制
- **Casbin集成** - 使用Casbin实现灵活的权限策略
- **租户隔离** - 支持多租户的权限隔离

## 权限模型

### 访问级别

- `none` - 无访问权限
- `read` - 只读访问
- `write` - 读写访问
- `admin` - 管理员权限

## API接口

### 组件授权检查

```bash
POST /api/authz/check-component
{
  "token": "Bearer xxx",
  "componentId": "uuid",
  "requiredLevel": "read"
}
```

### 角色管理

```bash
# 授予用户角色
POST /api/authz/roles/grant
{
  "userId": "uuid",
  "roleId": "uuid"
}
```

## 在组件后端使用

```javascript
const axios = require('axios');
const AUTHZ_SERVICE_URL = 'http://localhost:6000';

const checkComponentAccess = async (req, res, next) => {
  try {
    const response = await axios.post(
      `${AUTHZ_SERVICE_URL}/api/authz/check-component`,
      {
        token: req.headers.authorization,
        componentId: 'your-component-id',
        requiredLevel: 'read'
      }
    );

    if (!response.data.allowed) {
      return res.status(403).json({ error: '无组件访问权限' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: '授权检查失败' });
  }
};
```
