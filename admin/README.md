# AI Nest Platform — Frontend

对接 `hot-swappable-module`（NestJS 热插拔平台）的 Web 管理台。

## 技术栈

- React 19 + Vite + TypeScript
- React Router
- TanStack Query
- 自封装 `fetch` API 客户端（Bearer Token）

## 启动

先启动后端（默认 `http://localhost:3000`）：

```bash
cd ../hot-swappable-module
npm run start:dev
```

再启动本前端：

```bash
npm install
npm run dev
```

浏览器打开 Vite 提示的地址（默认 `http://localhost:5173`）。开发环境下 `/api` 会代理到后端。

## 默认账号

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

## 功能概览

- 登录 / 注册
- Dashboard（health / metrics）
- Modules 热插拔生命周期
- Users / Tenants / RBAC
- Config / Feature Flags
- Audit / Events / Jobs / Storage / Extensions
- AI Chat、Demo 业务模块页面

## 脚本

```bash
npm run dev      # 开发
npm run build    # 生产构建
npm run preview  # 预览构建产物
```
