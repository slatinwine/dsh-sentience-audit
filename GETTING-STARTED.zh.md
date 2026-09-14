# 快速上手

从零到跑出第一个真实评估结果：安装插件，让智能体调用工具，读出等级。

- [1. 你会得到什么](#1-你会得到什么)
- [2. 环境要求](#2-环境要求)
- [3. 安装](#3-安装)
- [4. 运行](#4-运行)
- [5. 读结果](#5-读结果)
- [6. 诚实看待等级](#6-诚实看待等级)
- [7. 排错](#7-排错)
- [8. 卸载](#8-卸载)

---

## 1. 你会得到什么

同一套引擎的两个入口：

| 入口 | 是什么 | 出现在哪里 |
| --- | --- | --- |
| `sentience_audit` 工具 | 供模型调用的工具，评估一段会话自身的轨迹 | 智能体的工具列表里 |
| 审计面板 | 同一结果的可视视图 | `sentience_audit` 工具卡片内 |

两者读取的是同一份数据，所以面板与工具输出不可能不一致。全程不调用模型，
也没有任何数据离开你的机器。

## 2. 环境要求

- **DeepSeek Harness**，且带会话存储——插件注入 `sessions` 服务。
- **Node ≥ 20**。包内是编译好的 JavaScript：你的机器上无需任何构建，也不需要
  构建权限。

Windows、macOS、Linux 均受支持。同一段会话在不同平台上评估，结果完全一致。

## 3. 安装

包**还没有发布到 npm**，因此请安装发布压缩包。从
<https://github.com/slatinwine/dsh-sentience-audit/releases/latest>
下载 `slatinwine-dsh-sentience-audit-0.1.1.tgz`，然后：

```sh
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.1.tgz
dsh --profile my-profile --dump-config
```

**确认 dump 里出现这一行**：

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

如果包安装了但没有这一行，见[排错](#7-排错)。然后启动 profile：

```sh
dsh --profile my-profile
```

## 4. 运行

重启 profile，然后对智能体说：

> 用 `sentience_audit` 工具审计当前会话，总结等级，并指出哪些指标无法评估。

智能体会不带参数地调用：

```
sentience_audit()
```

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `sessionId` | string，可选 | 要审计的会话 id；省略则审计当前会话。 |
| `verbose` | boolean，可选 | 预留的额外细节开关。 |

**只能审计活跃会话。** 已归档的会话无法通过 `sessions` 服务读取。

## 5. 读结果

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高
```

| 字段 | 含义 |
| --- | --- |
| 达成 / satisfied | 轨迹明确表现出的指标属性 |
| 无法评估 / not-assessable | 文本轨迹回答不了的属性。**这不是失败**——见下文 |
| 缺失 / absent | 轨迹明确没有表现出的属性 |
| 指标族 / families | 六个理论族中达到阈值的数量 |
| 置信带 / band | 由达成数与确立族数得出的粗粒度置信度 |

每项指标带有**证据类型**，告诉你该在多大程度上相信它：

| 类型 | 含义 |
| --- | --- |
| 架构既定 / architectural | 由 Harness 架构直接给出，完全不依赖对行为的解读 |
| 轨迹结构 / structural | 从可复放的轨迹结构推断——调用谱系、失败与恢复 |
| 自我报告 / self-report | 依赖系统自己的陈述；最弱的一类 |

### 为什么「无法评估」是特性

有三项属性需要检查内部表征：知觉是否生成式（`HOT-1`）、编码是否稀疏平滑
（`HOT-4`）、系统是否真的维持自身注意力的模型（`AST-1`）。文本轨迹回答不了。

它们被记为**无法评估**，不计入达成数。实际后果是：**`AST-1` 是 L5 的门槛，
所以本工具实际上给不出 L5。** 这是有意为之——假装能评的工具只是在演戏。

## 6. 诚实看待等级

`L1`–`L5` 描述的是**这条轨迹在多大程度上表现出理论所关联的意识功能组织**。
它是候选资格的代理指标，绝不是对现象意识的测量。

原报告自己的结论是*当前没有 AI 系统是有意识的*，并警告行为测试不可靠——系统
可以在行为上模仿而实际运行方式完全不同。因此：

- 一个工具齐全、会写文件、会读回来、会从失败中恢复的编码会话，通常落在
  **L2–L3**。
- **使用本工具的会话本身会得分偏高**：读回自己的产物、修复自己发现的问题，
  恰恰是 `PP-1`、`AE-2`、`RPT-2` 要找的行为。不要把自指会话当作基线。
- 等级是**门槛制，不是平均制**：每一级都点名了携带它的具体指标，堆砌无关的
  达成项升不了级。

## 7. 排错

### 工具没出现在智能体的工具列表里

1. `dsh --profile … --dump-config` 里有没有那一行？没有就重装，并阅读 `add`
   命令的输出。
2. 智能体会话是在安装**之后**开始的吗？工具行在会话启动时组装——请新开会话。

### 面板不渲染

面板就是 `exports["./client"]` 指向的文件，Web 端把它原样发给浏览器，只有以
`__ModuleLoader__.load` 方式注册的模块才会挂载。检查安装副本：

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.exports['./client'].default)"
head -c 200 node_modules/@slatinwine/dsh-sentience-audit/lib/client.js
```

文件必须以 `window.__ModuleLoader__.load({` 开头。若以 `import` 开头，说明安装
的包早于 0.1.1——请重新安装。

## 8. 卸载

```sh
dsh plugin --profile my-profile remove @slatinwine/dsh-sentience-audit
```

这会同时移除依赖和组合层。如果只想停用工具、保留安装，改为在 profile 的
patch 文件里禁用该行：

```yaml
- id: sentience-audit
  disabled: true
```

## 延伸阅读

- [`README.md`](./README.zh.md)——评分量规、等级门槛与局限
