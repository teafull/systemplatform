# 部署指南

## Docker 部署

### 1. 构建镜像

```bash
# 构建所有服务镜像
docker-compose build

# 或单独构建某个服务
docker-compose build auth-center
```

### 2. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart
```

### 3. 初始化数据库

```bash
# 进入认证中心容器
docker-compose exec auth-center sh

# 创建数据库（如果需要）
psql -U postgres -h postgres -c "CREATE DATABASE platform_auth;"
psql -U postgres -h postgres -c "CREATE DATABASE platform_registry;"

# 退出容器
exit
```

### 4. 注册默认用户

```bash
# 注册管理员用户
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123",
    "displayName": "系统管理员"
  }'
```

## Kubernetes 部署

### 1. 创建命名空间

```bash
kubectl create namespace platform
```

### 2. 部署数据库

```bash
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
```

### 3. 部署应用服务

```bash
kubectl apply -f k8s/auth-center/
kubectl apply -f k8s/component-registry/
kubectl apply -f k8s/platform-portal/
```

### 4. 创建 Ingress

```bash
kubectl apply -f k8s/ingress/
```

## 生产环境配置

### 1. 环境变量配置

创建 `.env.production` 文件：

```bash
# 认证中心
JWT_SECRET=your-production-jwt-secret-very-long-and-random
REFRESH_TOKEN_SECRET=your-production-refresh-token-secret
CORS_ORIGIN=https://your-domain.com

# 数据库
DB_HOST=your-db-host
DB_PASSWORD=strong-db-password

# Redis
REDIS_PASSWORD=strong-redis-password
```

### 2. Nginx 反向代理配置

```nginx
upstream auth_center {
    server localhost:4000;
}

upstream component_registry {
    server localhost:5000;
}

upstream platform_portal {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # 主应用
    location / {
        proxy_pass http://platform_portal;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 认证中心API
    location /api/auth/ {
        proxy_pass http://auth_center/api/auth/;
        proxy_set_header Host $host;
    }

    # 组件注册中心API
    location /api/registry/ {
        proxy_pass http://component_registry/api/registry/;
        proxy_set_header Host $host;
    }
}
```

### 3. HTTPS 配置

使用 Let's Encrypt 证书：

```bash
# 安装 certbot
apt-get install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com
```

## 监控和日志

### 1. 日志收集

```bash
# 查看所有容器日志
docker-compose logs

# 查看特定服务日志
docker-compose logs -f auth-center

# 日志轮转配置
# 在 /etc/docker/daemon.json 添加：
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 2. 健康检查

```bash
# 检查认证中心
curl http://localhost:4000/health

# 检查组件注册中心
curl http://localhost:5000/health

# 检查平台主应用
curl http://localhost:3000
```

## 备份和恢复

### 1. 数据库备份

```bash
# 备份认证中心数据库
docker-compose exec postgres pg_dump -U postgres platform_auth > auth_backup.sql

# 备份组件注册中心数据库
docker-compose exec postgres pg_dump -U postgres platform_registry > registry_backup.sql
```

### 2. 数据库恢复

```bash
# 恢复认证中心数据库
docker-compose exec -T postgres psql -U postgres platform_auth < auth_backup.sql

# 恢复组件注册中心数据库
docker-compose exec -T postgres psql -U postgres platform_registry < registry_backup.sql
```

## 故障排查

### 1. 端口冲突

```bash
# 检查端口占用
lsof -i :4000
lsof -i :5000

# 修改 docker-compose.yml 中的端口映射
```

### 2. 数据库连接失败

```bash
# 检查数据库状态
docker-compose ps postgres

# 查看数据库日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec auth-center psql -U postgres -h postgres -d platform_auth
```

### 3. Redis 连接失败

```bash
# 检查 Redis 状态
docker-compose ps redis

# 测试 Redis 连接
docker-compose exec redis redis-cli ping
```

## 性能优化

### 1. 数据库优化

- 添加索引
- 配置连接池
- 启用查询缓存

### 2. Redis 优化

- 配置持久化
- 设置合适的内存策略
- 使用集群模式

### 3. 应用优化

- 启用 Gzip 压缩
- 配置 CDN
- 使用负载均衡
