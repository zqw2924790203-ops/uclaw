# ⚡ UClaW — Portable OpenClaw Gateway

便携版 OpenClaw AI 网关，放在 U 盘里随处运行。

## 快速开始

### 方式一：下载 Release（推荐）

1. 下载 [最新 Release](../../releases/latest) 的 `UClaW-v1.0.0.zip`
2. 解压到 U 盘或任意目录
3. 双击 `Launch-ModelSwitcher.bat`

### 方式二：从源码构建

```bash
git clone https://github.com/YOUR_USERNAME/uclaw.git
cd uclaw
setup.bat    # 自动下载 Node.js + 安装 OpenClaw
Launch.bat   # 启动
```

## 功能

| 功能 | 说明 |
|------|------|
| 🤖 模型切换 | 一键切换 6 个预配置提供商（CC Switch 风格） |
| 🔑 API 配置 | Web UI 管理 API Key 和 Base URL |
| ➕ 添加提供商 | 自定义添加任意 OpenAI/Anthropic 兼容 API |
| 🌐 Gateway 监控 | 实时查看 Gateway 运行状态 |
| 📦 完全便携 | 无需安装，U 盘即插即用 |

## 预配置模型

| 提供商 | 模型 | 分类 | 免费 |
|--------|------|------|------|
| DeepSeek | V4 Pro / V4 Flash | 国内官方 | ✅ |
| MiniMax | M2.7 | 国内官方 | ✅ |
| NVIDIA | DeepSeek V4 Pro | 国际 | ✅ |
| GreatRouter | GPT-5.4 Pro | 中转 | - |
| Codex | GPT-5.4 / 5.4 Mini | 官方 | - |
| Xiaomi MiMo | V2.5 Pro | 国内官方 | - |

## 项目结构

```
UClaW/
├── Launch.bat                 # 一键启动
├── Launch-ModelSwitcher.bat   # 控制面板 + 模型切换
├── setup.bat                  # 首次运行安装脚本
├── Deploy.bat                 # 部署到 U 盘
├── ModelSwitcher.html         # Web UI 控制面板
├── bin/
│   ├── config-server.js       # 配置管理服务器
│   ├── node/                  # [gitignore] Node.js v24.14.1
│   └── openclaw/              # [gitignore] OpenClaw v2026.6.1
├── data/
│   ├── openclaw.json          # OpenClaw 主配置
│   ├── providers.json         # 提供商数据库
│   ├── agents/                # Agent 配置
│   ├── skills/                # 技能
│   └── extensions/            # 插件
└── models/
    ├── current.json           # 当前激活模型
    └── profiles/              # 模型预设配置
```

## 架构

```
Launch-ModelSwitcher.bat
  ├─ Gateway (port 18789)      ← OpenClaw AI 网关
  └─ Config Server (port 18790) ← 提供商管理 API + Web UI
       └─ 浏览器自动打开控制面板
```

**模型切换流程：**
1. 用户在 Web UI 点击切换
2. Config Server 更新 `providers.json` 的 `isCurrent` 标志
3. 写入 `openclaw.json` 的 `models.providers` + `agents.defaults.model.primary`
4. 同步 API Key 到所有 Agent 配置
5. 重启 Gateway 生效

## 环境要求

- Windows 10/11 x64
- 无需管理员权限
- 无需预装任何软件
- 需要网络连接（调用 AI API）

## 许可证

MIT License
