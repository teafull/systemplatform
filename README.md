# 软件平台 - 组件化架构系统

基于组件化架构设计的软件平台，支持独立组件开发、前端页面集成和单点登录。

## 📋 项目结构

```
systemplatform/
├── auth-center/              # 认证中心（SSO）
│   ├── src/
│   │   ├── config/          # 配置（数据库、Redis）
│   │   ├── services/        # 业务服务（JWT、认证）
│   │   ├── middleware/      # 中间件（认证、权限）
│   │   ├── routes/          # API路由
│   │   └── index.js         # 入口文件
│   ├── package.json
│   └── .env.example         # 环境变量模板
│
├── authorization-center/     # 授权中心（AuthZ）
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── services/        # 授权服务（Casbin、授权）
│   │   ├── middleware/      # 授权中间件
│   │   ├── routes/          # API路由
│   │   └── index.js         # 入口文件
│   ├── package.json
│   └── .env.example
│
├── component-registry/      # 组件注册中心
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── services/        # 组件管理服务
│   │   ├── routes/          # API路由
│   │   └── index.js         # 入口文件
│   ├── package.json
│   └── .env.example
│
├── platform-portal/         # 平台主应用（微前端）
│   ├── src/
│   │   ├── stores/          # 状态管理（auth、component）
│   │   ├── micro-apps/      # 微应用管理
│   │   ├── components/      # UI组件
│   │   ├── pages/           # 页面组件
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── example-component/       # 示例组件
│   ├── frontend/            # 前端
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── backend/             # 后端
│   │   ├── src/
│   │   └── package.json
│   └── manifest.json        # 组件清单
│
├── ARCHITECTURE.md          # 架构设计文档
└── README.md                # 项目说明
```

## 🚀 快速开始

### 前置要求

- Node.js >= 16.x
- PostgreSQL >= 13.x
- Redis >= 6.x

### 1. 安装依赖

```bash
# 安装认证中心依赖
cd auth-center
npm install

# 安装授权中心依赖
cd ../authorization-center
npm install

# 安装组件注册中心依赖
cd ../component-registry
npm install

# 安装平台主应用依赖
cd ../platform-portal
npm install

# 安装示例组件依赖
cd ../example-component/frontend
npm install

cd ../backend
npm install
```

### 2. 配置环境变量

```bash
# 认证中心配置
cd auth-center
cp .env.example .env
# 编辑 .env 文件，配置数据库、Redis等

# 授权中心配置
cd ../authorization-center
cp .env.example .env
# 编辑 .env 文件

# 组件注册中心配置
cd ../component-registry
cp .env.example .env
# 编辑 .env 文件
```

### 3. 初始化数据库

```bash
# 创建数据库
createdb platform_auth
createdb platform_authz
createdb platform_registry

# 启动认证中心（会自动初始化数据库表）
cd auth-center
npm run dev
```

### 4. 启动服务

```bash
# 终端1：认证中心
cd auth-center
npm run dev

# 终端2：授权中心
cd authorization-center
npm run dev

# 终端3：组件注册中心
cd component-registry
npm run dev

# 终端4：平台主应用
cd platform-portal
npm run dev

# 终端5：示例组件前端
cd example-component/frontend
npm run dev

# 终端6：示例组件后端
cd example-component/backend
npm run dev
```

### 5. 注册示例组件

首次启动后，需要将示例组件注册到组件注册中心：

```bash
curl -X POST http://localhost:5000/api/registry/components \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "example-component",
    "displayName": "示例管理组件",
    "description": "这是一个示例组件",
    "version": "1.0.0",
    "frontendUrl": "http://localhost:3001",
    "backendUrl": "http://localhost:3002",
    "routePath": "/example",
    "category": "demo",
    "permissions": ["user.read"],
    "author": "system"
  }'
```

### 6. 访问系统

- 平台主应用：http://localhost:3000
- 认证中心API：http://localhost:4000
- 组件注册中心API：http://localhost:5000
- 默认登录用户：需要先通过注册API创建

## 📦 服务端口

| 服务 | 端口 |
|------|------|
| 平台主应用 | 3000 |
| 认证中心 | 4000 |
| 组件注册中心 | 5000 |
| 授权中心 | 6000 |
| 示例组件前端 | 3001 |
| 示例组件后端 | 3002 |

## 🔐 认证和授权流程

### 单点登录流程

1. 用户访问平台主应用
2. 主应用检查本地Token
3. Token无效 → 重定向到认证中心登录
4. 认证中心颁发JWT Token
5. 主应用存储Token并加载组件
6. 各子应用通过共享Token访问后端

### 组件授权流程

```
1. 用户访问组件
   ↓
2. 组件前端调用授权中心检查组件访问权限
   ↓
3. 授权中心验证Token并检查用户角色
   ↓
4. 返回访问权限级别（none/read/write/admin）
   ↓
5. 根据权限级别显示/隐藏组件内容
   ↓
6. 用户执行操作时，组件后端再次验证权限
```

## 🧩 开发新组件

### 1. 创建组件目录

```
components/
└── your-component/
    ├── frontend/
    ├── backend/
    └── manifest.json
```

### 2. 配置 manifest.json

```json
{
  "id": "your-component",
  "name": "your-component",
  "version": "1.0.0",
  "displayName": "组件名称",
  "description": "组件描述",
  "entry": "http://localhost:port/index.js",
  "container": "#subapp-container",
  "activeRule": "/your-path",
  "backendUrl": "http://localhost:port",
  "category": "category",
  "permissions": []
}
```

### 3. 前端实现（qiankun）

```typescript
// main.tsx
export async function bootstrap() {
  console.log('Component bootstrap')
}

export async function mount(props) {
  const { getGlobalState } = props
  // 使用全局状态获取token等
  const { token } = getGlobalState()
  // 渲染应用
}

export async function unmount(props) {
  // 清理
}
```

### 4. 后端实现

后端需要实现Token验证和权限检查：

```javascript
// 向认证中心验证Token
const response = await axios.post(
  'http://localhost:4000/api/auth/verify',
  { token: req.headers.authorization.replace('Bearer ', '') }
);

// 向授权中心检查组件访问权限
const authzResponse = await axios.post(
  'http://localhost:6000/api/authz/check-component',
  {
    token: req.headers.authorization,
    componentId: 'your-component-id',
    requiredLevel: 'read'
  }
);

if (!authzResponse.data.allowed) {
  return res.status(403).json({ error: '无组件访问权限' });
}
```

## 🛠️ 技术栈

- **主框架**: React 18 + TypeScript
- **微前端**: qiankun 2.x
- **状态管理**: Zustand
- **UI组件**: Ant Design
- **认证中心**: Node.js + Express + JWT
- **授权中心**: Node.js + Express + Casbin
- **组件注册中心**: Node.js + Express
- **数据库**: PostgreSQL
- **缓存**: Redis
- **权限引擎**: Casbin

## 🚢 部署

### Docker部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

### Kubernetes部署

```bash
kubectl apply -f k8s/
```

## 📝 注意事项

1. **安全性**
   - 生产环境必须修改所有JWT密钥
   - 使用HTTPS加密传输
   - 配置CORS白名单

2. **性能**
   - 使用Redis缓存会话
   - 组件按需加载
   - CDN分发静态资源

3. **扩展性**
   - 组件可独立部署
   - 支持横向扩展
   - 数据库可分库分表

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
