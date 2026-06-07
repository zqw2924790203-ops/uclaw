# ⚡ UClaW — Portable OpenClaw Gateway

便携版 OpenClaw AI 网关，U 盘即插即用，无需安装。

## 快速开始

### 下载 Release（推荐）

1. 下载 [UClaW-v1.2.0.zip](https://github.com/zqw2924790203-ops/uclaw/releases/latest)
2. 解压到 U 盘或任意目录
3. 双击 `Launch-ModelSwitcher.bat`
4. 浏览器自动打开控制面板，首次运行引导填入 API Key

### 从源码构建

```bash
git clone https://github.com/zqw2924790203-ops/uclaw.git
cd uclaw
setup.bat          # 自动下载 Node.js + 安装 OpenClaw
Launch-ModelSwitcher.bat  # 启动
```

## 控制面板 (8 个页面)

| 页面 | 功能 |
|------|------|
| 🔄 模型切换 | 一键切换提供商，内联编辑 API Key，连接测试 |
| 💬 测试对话 | SSE 流式输出，多轮对话测试模型效果 |
| 🌐 Gateway | 启动/停止/重启，实时日志查看，配置回滚 |
| 📊 用量统计 | 每个模型的调用次数和 Token 消耗 |
| ➕ 添加提供商 | 添加自定义 OpenAI/Anthropic 兼容 API |
| 🔌 插件管理 | 开关 OpenClaw 内置插件 |
| 🤖 Agent 管理 | 配置 Agent 使用的模型 |
| 💾 导入导出 | 配置备份、多设备同步 |

## 预配置模型提供商

| 提供商 | 模型 | 分类 | 免费 |
|--------|------|------|------|
| DeepSeek | V4 Pro / V4 Flash | 国内官方 | ✅ |
| MiniMax | M2.7 | 国内官方 | ✅ |
| NVIDIA | DeepSeek V4 Pro | 国际 | ✅ |
| GreatRouter | GPT-5.4 Pro | 中转 | - |
| Codex | GPT-5.4 / 5.4 Mini | 官方 | - |
| Xiaomi MiMo | V2.5 Pro | 国内官方 | - |

## 核心特性

- 🔄 **模型切换自动重启** — 切换后 Gateway 自动重启，无需手动操作
- 🛡️ **Gateway 守护进程** — 崩溃自动重启（15s 检测，最多重试 5 次）
- ⏪ **配置回滚** — 修改前自动备份，出问题一键恢复
- ⚡ **流式聊天** — SSE 逐字输出，实时查看模型回复
- 📦 **完全便携** — 无需管理员权限，无需预装任何软件

## 项目结构

```
UClaW/
├── Launch.bat                   # 一键启动 Gateway + 打开 Web UI
├── Launch-ModelSwitcher.bat     # 控制面板（Gateway + Config Server）
├── setup.bat                    # 首次运行：下载 Node.js + 安装 OpenClaw
├── ModelSwitcher.html           # Web UI 控制面板（单文件）
├── bin/
│   ├── config-server.js         # 配置管理服务器（Gateway 生命周期管理）
│   ├── node/                    # Node.js v24.14.1 便携运行时
│   └── openclaw/                # OpenClaw v2026.6.1 包
├── data/
│   ├── openclaw.json            # OpenClaw 主配置
│   ├── providers.json           # 提供商数据库
│   ├── agents/                  # Agent 配置
│   ├── skills/                  # 技能
│   ├── extensions/              # 插件
│   └── usage.json               # 用量统计
├── models/
│   └── profiles/                # 模型预设
└── .github/workflows/           # CI/CD 自动构建
```

## 架构

```
Launch-ModelSwitcher.bat
  └─ Config Server (port 18790)
       ├─ Gateway 进程管理 (port 18789)
       ├─ 提供商数据库 API
       ├─ 聊天代理 API
       ├─ 用量统计 API
       └─ 配置导入导出 API
```

## 环境要求

- Windows 10/11 x64
- 网络连接（调用 AI API）
- 无需管理员权限

## License

MIT
