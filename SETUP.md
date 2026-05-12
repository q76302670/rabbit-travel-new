# 兔子旅行 — 项目搭建说明

## 项目路径

`/Users/qy/WeChatProjects/rabbit-travel-new/`

## 需要在微信开发者工具中手动完成的步骤

### 1. 开通云开发环境
- 工具栏 → 「云开发」→ 开通环境
- 建议环境名称：`rabbit-travel-prod`

### 2. 配置云环境 ID
打开 `config/index.js`，替换 `CLOUD_ENV` 值为实际环境 ID：
```js
export const CLOUD_ENV = '你的环境ID'
```
同时打开 `app.js`，替换 `env` 值。

### 3. 创建数据库集合
在云开发控制台 → 数据库 → 创建以下集合：
- `users` — 用户表
- `journals` — 游记表
- `nodes` — 行程节点表
- `comments` — 评论表
- `notifications` — 消息通知表

### 4. 部署云函数
右键各云函数目录 → 「上传并部署（云端安装依赖）」：
- `cloudfunctions/login`
- `cloudfunctions/journal`
- `cloudfunctions/comment`
- `cloudfunctions/notification`
- `cloudfunctions/parseExif`

### 5. 云存储权限
云开发控制台 → 存储 → 权限设置：所有用户可读，仅创建者可写

## 当前项目结构

```
rabbit-travel-new/
├── app.js                  # 小程序入口
├── app.json                # 页面路由 + TabBar
├── app.wxss                # 全局样式
├── project.config.json     # 项目配置
├── sitemap.json
├── SETUP.md
├── config/
│   └── index.js            # 全局配置常量
├── services/
│   └── user-service.js     # 用户服务
├── utils/
│   └── util.js             # 通用工具函数
├── models/                 # 数据模型（待开发）
├── custom-tab-bar/         # 自定义 TabBar
├── pages/
│   ├── index/              # 首页
│   ├── publish/            # 发布
│   ├── profile/            # 我的
│   ├── login/              # 登录
│   ├── journal/detail/     # 游记详情
│   ├── search/             # 搜索
│   ├── message/            # 消息
│   ├── drafts/             # 草稿箱
│   ├── user/profile/       # 他人主页
│   ├── edit-profile/       # 编辑资料
│   ├── my-journals/        # 我的游记
│   ├── collections/        # 收藏
│   ├── likes/              # 点赞
│   └── admin/              # 管理后台
└── cloudfunctions/
    ├── login/              # 用户登录
    ├── journal/            # 游记 CRUD
    ├── comment/            # 评论系统
    ├── notification/       # 消息通知
    └── parseExif/          # EXIF 解析
```
