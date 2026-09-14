# 快速上手

从零到跑出第一个真实评估结果。如果只看一节，请看[第 4 节](#4-运行)和[第 5 节](#5-读结果)。

- [1. 你会得到什么](#1-你会得到什么)
- [2. 环境要求](#2-环境要求)
- [3. 安装](#3-安装)
- [4. 运行](#4-运行)
- [5. 读结果](#5-读结果)
- [6. 诚实看待等级](#6-诚实看待等级)
- [7. 不走工具：用代码评估](#7-不走工具用代码评估)
- [8. 排错](#8-排错)
- [9. 卸载](#9-卸载)
- [10. 发布（作者侧）](#10-发布作者侧)

---

## 1. 你会得到什么

同一套引擎的两个入口：

| 入口 | 是什么 | 出现在哪 |
| --- | --- | --- |
| `sentience_audit` 工具 | 可由模型调用的工具，审计会话自身的轨迹 | Agent 的工具列表里 |
| 审计面板 | 同一结果的可视视图 | `sentience_audit` 工具卡片内 |

两者调用同一份确定性代码，所以面板与工具输出不可能不一致。全程不调用模型，也不向外发送任何数据。

## 2. 环境要求

- **DeepSeek Harness**，且具备会话存储——插件注入 `sessions` 并注册进 `tools`；可选读取 `agents` 用于解析调用方。
- **Node ≥ 20**。包内的 TypeScript 已编译为 ES2022 并使用 `.js` 说明符，你这边无需构建。
- **走 bundle 安装路径需要一个 pnpm 支撑的 profile**（`dsh plugin … add`）。
  若你的 profile 没有接包管理器，改用[排错一节里的覆盖层方式](#a-没有包管理器时如何安装)。

### 平台

Windows、macOS、Linux 都支持，包内没有任何平台专属内容：无原生模块、无 shell 脚本、安装时不构建。
发布出去的 `lib/` 是编译后的 JavaScript，**Node ≥ 20** 即可使用。

跑测试套件是另一回事：它们是 TypeScript，由 Node 的类型剥离直接执行，需要 **Node ≥ 22.18.0**。
这是**开发工具链**的下限，不是运行时的下限。

分析器读取的是轨迹里的路径，所以在 macOS 上审计同一会话，与在 Windows 上得到相同的数字。
平台真正影响行为的三处位置及各自处理方式见 [平台兼容](./README.zh.md#平台兼容)。

## 3. 安装

### 推荐：安装 release 附件里的 tarball

本包**尚未发布到 npm registry**，所以请从 release 附件开始——下载
`slatinwine-dsh-sentience-audit-0.1.0.tgz`：
<https://github.com/slatinwine/dsh-sentience-audit/releases/latest>。

它已含构建好的 `lib/`，所以**你机器上不构建任何东西，也不需要任何构建放行**。
包内同时声明了 `dsh.bundle.patch`，这正是本次安装会贡献一个组合层（含一行）的原因：

```sh
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
dsh --profile my-profile --dump-config
```

**务必确认这一行出现在 dump 里**：

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

如果包装上了但这一行没出现，说明 `dsh.bundle` 声明没解析成功——见[排错 b](#b-装了但没有出现插件行)。

然后启动 profile：

```sh
dsh --profile my-profile
```

### alternative：自己打出同一个 tarball

从本仓库的检出目录执行 `npm pack`，得到的是同一个产物：

```sh
npm pack                                   # 在包目录内执行
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
```

### alternative：从 npm 安装（仅当将来真的发布到 registry 时）

```sh
dsh plugin --profile my-profile add @slatinwine/dsh-sentience-audit
```

对 DSH bundle 来说，发布到 registry 是可选的，本包并未发布。上面每一条路径都
**不需要 npm 账号、不需要 registry、不需要登录**。

### alternative：从 Git 安装

只有在你确实想跟着源码走时才用。Git 安装取到的是**源码而非构建产物**，
因此 pnpm 必须运行本包的 `prepare` 脚本——而 pnpm ≥ 10 在显式放行前拒绝执行。
首次 `add` 会失败，并打印需要复制进 profile 的 `pnpm-workspace.yaml` 的键：

```yaml
allowBuilds:
  '@slatinwine/dsh-sentience-audit': true
```

然后重跑 `add`。**这次放行意味着「允许本包在安装时于你机器上执行代码」**，
它运行在 agent 所用沙箱之外。建议钉住 tag（`github:slatinwine/dsh-sentience-audit#v0.1.0`），
以免之后一次 push 悄悄改变实际执行内容。除非确实需要源码，否则请优先用 tarball。

### 本地开发：用覆盖层直接加载

想从检出目录直接跑而不安装，就让覆盖层指向构建产物入口。写一个 `sentience-audit.patch.yml`：

```yaml
- insert:
    - id: sentience-audit
      name: '<可被解析到检出包的说明符>'
```

说明符必须是加载器能解析的形式。本地检出用绝对路径——而 **Windows 上的绝对路径必须写成 `file://` URL**，
否则 Node 的 ESM 加载器会把盘符当成 URL 协议，报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。别手写，用命令生成：

```powershell
node -e "const{pathToFileURL}=require('node:url');console.log(pathToFileURL(process.argv[1]).href)" "$PWD\lib\index.js"
```

把打印出来的值粘进 `name:`，再带覆盖层启动：

```sh
dsh --profile my-profile --patch ./sentience-audit.patch.yml
```

> 覆盖层是 DSH 标准的 `--patch` 机制。**我没有在运行中的部署上实际执行过这条确切命令**，
> 所以请把它当作文档路径而非已验证路径；本包实际构建与打包所面向的是上一节的 bundle 安装方式。

### 层序（为什么你的改动有时不生效）

生效顺序如下，**按行**后者覆盖前者：

1. profile 的 bundles，按 manifest 顺序；
2. profile 自己的 `cordis.patch.yml`；
3. `$DSH_HOME/cordis.patch.yml`；
4. `--patch` 覆盖层，按命令行顺序。

注意：patch 替换目标行的**整个 `config`**，不做深合并。所以要写全你关心的每个键。

## 4. 运行

重启 profile，然后对 agent 说：

> 用 `sentience_audit` 工具审计本会话，然后总结等级，以及哪些指标未满足。

模型会不带参数地调用：

```
sentience_audit()
```

### 参数

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `sessionId` | 字符串，可选 | 要审计的会话。省略则审计本次调用所在的会话。 |
| `verbose` | 布尔，可选 | 预留，用于返回更多细节。 |

「审哪个会话」的解析顺序：显式 `sessionId` → 执行中 agent 的会话 → agent 服务当前的发起者。
三者都无法解析时，工具返回可读的错误，而不是猜测。

**只有实时会话可被审计。** 已归档的会话无法经 `sessions` 服务读取。要审一个已结束的会话，
需要自己解码它的日志再调用 `assess`——见[第 7 节](#7-不走工具用代码评估)。

## 5. 读结果

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高
```

| 字段 | 含义 |
| --- | --- |
| 达成 | 该轨迹确实具备的指标属性 |
| 无法评估 | 文字轨迹回答不了的属性。**不是失败**，见下 |
| 缺失 | 轨迹明确没有表现出来的属性 |
| 指标族 | 六套理论族中有多少达到了各自阈值 |
| 置信带 | 由达成数与族数推出的粗粒度置信 |

每条指标都带**证据类型**，它告诉你这条结论该信多少：

| 类型 | 含义 |
| --- | --- |
| 架构既定 | 由 Harness 架构本身提供，完全不依赖读取行为 |
| 轨迹结构 | 由可复算的结构推断——调用链、失败、恢复 |
| 自我报告 | 若依赖系统对自身的陈述，则属最弱一档 |

### 为什么「无法评估」是特性而不是缺陷

有三项属性需要检查内部表征：知觉是否生成式（`HOT-1`）、编码是否稀疏平滑（`HOT-4`）、
系统是否真的维护关于自身注意状态的模型（`AST-1`）。文字轨迹回答不了这些。

它们被标为**无法评估**，且不计入达成数。实际后果是：**`AST-1` 卡住 L5，所以本工具事实上给不出 L5。**
这是刻意的。假装能给的工具只是在做戏。

## 6. 诚实看待等级

`L1`–`L5` 描述的是**该轨迹在多大程度上实现了这些理论所关联的功能组织**。它是候选资格的代理指标，永远不是对体验的测量。

原报告的结论就是 *no current AI systems are conscious*，并警告行为测试不可靠——系统可以模仿行为而运作方式完全不同。因此：

- 工具丰富、会写文件、会读回、会从失败中改变策略的编码会话，通常落在 **L2–L3**。
- **就在开发这个工具的会话上跑，分数会偏高**，因为「读回自己的产物、修掉自检发现的缺陷」正是
  `PP-1`、`AE-2`、`RPT-2` 最爱的信号。别把自指会话当作基线。
- 等级是**硬门槛，不是加权平均**：每一级都点名支撑它的具体指标，无法靠堆砌无关的满足项升级。

## 7. 不走工具：用代码评估

引擎就是普通导出，所以你可以评估手上已有的事件列表——不需要实时会话，也不需要调工具：

```ts
import { assess, renderMarkdown } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)
console.log(renderMarkdown(result))

for (const indicator of result.indicators) {
  console.log(indicator.id, indicator.status, indicator.evidence || indicator.note)
}
```

同时导出：`auditSession`、`auditEvents`、`RUBRIC`、`LEVELS`、`REQUIREMENTS`、`FAMILIES`、
`DISCLAIMER` 以及结果类型。

读取器接受 `Session.ownEvents()` 产生的形态。它对嵌套结构刻意宽容，遇到不认识的
事件会跳过而不是报错，所以邻近 DSH 版本的日志通常仍能工作——但**不认识的事件不贡献任何结构信号**，
这只会让分数偏低。如果结果低得出乎意料，先确认工具调用与结果是否真被解析到，再去怀疑会话本身。

## 8. 排错

### a. 没有包管理器时如何安装

如果 `dsh plugin --profile … add` 不可用，就把插件行写进 profile 自己的补丁文件
`$DSH_HOME/profiles/<profile>/cordis.patch.yml`：

```yaml
- insert:
    - id: sentience-audit
      name: '@slatinwine/dsh-sentience-audit'
```

前提是该包对 profile 可解析。这是 `dsh plugin add` 所做事情的等价手工版。

### b. 装了但没有出现插件行

说明 manifest 里的 `dsh.bundle.patch` 没解析成功。检查装好的副本：

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.dsh, p.files)"
```

`dsh.bundle.patch` 必须是 `./cordis.patch.yml`，且该文件必须列在 `files` 里，否则打包时会丢。

### c. 工具始终不出现在 agent 的列表里

1. `dsh --profile … --dump-config` 里有这一行吗？
2. agent 会话是在安装**之后**启动的吗？工具行在会话启动时组合。
3. 部署暴露了 `sessions` 服务吗？插件注入它；没有该服务的部署会让这一行处于等待，而不是报错。

### d. 有行但从未激活

等待服务的行按设计是静默的。跑 `--dump-config` 找出从未激活的行；缺失的服务名会出现在面向 agent 的运行时诊断里。

### e. 面板不渲染

Web 端会把 `exports["./client"]` 指向的文件**原样**发给浏览器，并且只有通过
`__ModuleLoader__.load` 注册的模块才会挂载，所以包里必须带上预构建、已包装的
`lib/client.js`，而不是裸的编译产物。检查安装副本：

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.exports['./client'].default)"
head -c 200 node_modules/@slatinwine/dsh-sentience-audit/lib/client.js
```

文件必须以 `window.__ModuleLoader__.load({` 开头。若以 `import` 开头，说明安装的
包早于 0.1.1——重新安装，或在源码检出里跑 `npm run build`（`bundle-client`
一步负责生成它）。

只有当包对客户端扫描可见、且 `./client` 构建产物存在时，客户端半边才会被发现。两项都查：

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.dsh?.client, p.exports['./client'])"
ls node_modules/@slatinwine/dsh-sentience-audit/lib/client/
```

如果提示 `client bundle not found`，说明发布的包里缺 `lib/client/`——它由 `npm run build` 生成，
而 `prepack` 会自动跑该构建。

## 9. 卸载

```sh
dsh plugin --profile my-profile remove @slatinwine/dsh-sentience-audit
```

这会同时移除依赖与组合层。若想保留包但撤下工具，改为在 profile 的补丁文件里禁用该行：

```yaml
- id: sentience-audit
  disabled: true
```

## 10. 发布（作者侧）

官方参考：[打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
（[中文版](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)）。
下面本包遵循该流程的要点。

### 发布一个 bundle 必须声明什么

| 要求 | 原因 |
| --- | --- |
| `dsh.bundle.patch` → `./cordis.patch.yml` | 缺它，`dsh plugin add` 只装一个普通依赖、打印一条警告、**不激活任何层** |
| 该 patch 文件列在 `files` 里 | 否则打包时丢掉，装上的包什么也不贡献 |
| 构建好的 `lib/` 列在 `files` 里 | npm 路径的消费者必须拿到可运行产物 |
| 一个 `prepare` 脚本 | `npm publish`/`npm pack` **和** Git 安装都会运行它；只写 `prepack` 会让 Git 安装拿不到 `lib/` |
| `publishConfig.access: "public"` | scoped 包默认是受限发布 |

### 发布顺序

```sh
# 1. 把真实包名同时写进 package.json 与 cordis.patch.yml —— 两处必须一致。
#    同时设好 repository.url，npm 页面与 provenance 显示的就是它。
# 2. 发布前先验产物。
npm test
npm pack --dry-run      # 确认 lib/、lib/client/、cordis.patch.yml 都在列表里
# 3. 发布。prepare 会先构建 lib/，所以过期或缺失的构建不可能被发出去。
npm publish
```

包名出现在**两个**地方——`package.json` 与 `cordis.patch.yml` 里的那一行。
只改一处会导致装完后解析不到任何层，而这正是[第 3 节](#3-安装)里 `--dump-config` 核对所要抓的静默失败。

### 为什么两条路径都保留

`prepare` 是 Git 路径能跑通的前提，而它对 npm 路径不产生额外负担：
`prepare` 同样会在 `npm pack` 与 `npm publish` 之前运行。代价只是发布机器上多一次构建。
npm 仍是推荐路径，因为它免去用户 `allowBuilds` 的放行；Git 路径保留给想读或改源码的人。

## 接下来读什么

- [`README.zh.md`](./README.zh.md) —— 量表、每个结构信号、以及各项局限
- [`src/core/rubric.ts`](./src/core/rubric.ts) —— 14 项属性与各级硬门槛，代码形态
