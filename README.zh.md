# dsh-sentience-audit

按 Butlin、Long、Elmoznino、**Bengio** 等 (2023) 提出的 **14 项意识指标属性**，审计
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 会话轨迹，输出 **L1–L5** 等级与逐条证据。

> **这不是意识测量仪。** 原报告的结论就是 *no current AI systems are conscious*，并且明确警告行为证据
> 不可靠——系统可以模仿行为而运作方式完全不同。L1–L5 应读作 *「该轨迹在多大程度上实现了这些理论所关联的
> 功能组织」*，它是**候选资格的代理指标，不是体验的测量**。

- **评分依据：**[Consciousness in Artificial Intelligence: Insights from the Science of Consciousness](https://arxiv.org/abs/2308.08708)
  （arXiv:2308.08708）Table 1，14 项指标属性，来自递归加工、全局工作空间、计算高阶理论、注意图式、
  预测加工、能动与具身六套理论。
- **方法：** 确定性计算。不调用模型、不使用 LLM 裁判、不联网。同一份事件日志永远得到同一结果，
  因此分数可复算、可 diff。

**第一次用？** 请看 [`GETTING-STARTED.zh.md`](./GETTING-STARTED.zh.md)（English: [`GETTING-STARTED.md`](./GETTING-STARTED.md)）。
**看一份真实报告：** [`docs/EXAMPLE-REPORT.md`](./docs/EXAMPLE-REPORT.md)。
**贡献代码：** [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 平台兼容

Windows、macOS、Linux 都支持。分析器里有三处与平台相关，每一处都**从轨迹自身推断**，而不是看它恰好跑在哪个平台上：

| 关注点 | 处理方式 |
| --- | --- |
| Shell 工具名 | Windows 的 `pwsh` / `powershell` 与 macOS、Linux 的 `bash` / `sh` / `zsh` / `dash` 视为同一个专门 shell 模块 |
| 读回探针 | 两种写法都识别：`cat`、`head`、`tail`、`wc`、`stat`、`sed`、`find`、`jq`…… 以及 `Get-Content`、`Select-String`、`Test-Path`、`Get-ChildItem`…… |
| 路径大小写 | 仅对**形如 Windows 的路径**折叠大小写。在 POSIX 文件系统上 `A.ts` 与 `a.ts` 是两个不同文件，合并它们会把不同产物混为一谈 |

大小写处理刻意**从路径自身的形态**推断约定（含反斜杠或有盘符即为 Windows），而不是读 `process.platform`。
这样分数就是事件日志的纯函数：同一会话在 macOS 与 Windows 上审计得到同一个数字，这正是结果可 diff、可复现的前提。
代价是：在 Windows 上使用 POSIX 分隔符的会话会被按大小写敏感处理——这种组合很少见，且只会**少报**产物，不会凭空多报。

`tests/platform.ts` 覆盖以上三点，其中包含一条 POSIX 轨迹，要求它与对应的 Windows 轨迹产生相同的结构信号。

## 为什么判定只看结构

早期版本用**措辞**打分——统计「假设」「验证」「取舍」这类词。那衡量的是用词而非架构，并且把分数整体抬高：
一段仅仅**讨论**意识的轨迹会被判成仿佛具备该属性。

因此本包只读取**可复算的轨迹结构**：

| 信号 | 实际衡量的东西 |
| --- | --- |
| `dependentCalls` | 后一次调用的参数里出现前一次结果提到的路径——「结果被消费」的可观测形式 |
| `moduleSuccessions` | 相邻调用跨越不同专门模块族 |
| `recoveries` | 工具失败后**真正**改变了做法的次数（见下） |
| `artifactReuse` | 本会话写出的路径随后被另一个工具取用 |
| `selfReadbacks` | 读取本会话自己写出的路径 |
| `injectionLoops` | 产出后再经输入模块观测回来的闭环 |

### 区分「真恢复」与「机械重试」

`recoveries` 是 L4 的硬门槛，所以不能被任意字符串差异满足。两次调用在**键排序后结构相等**时视为同一次尝试——纯粹的重新序列化不算新做法。
当参数不是合法 JSON（例如会话里被截断的大参数）时，回退比较的是两段内容**共享多少内容**，绝不比较共享词汇：
标识符在代码库里本就反复出现，一次整文件重写可能共享几乎所有 token，却是完全不同的尝试。

```ts
import { approachChanged } from '@slatinwine/dsh-sentience-audit'

approachChanged('{"a":1,"b":2}', '{"b":2,"a":1}')   // false —— 同一负载
approachChanged('{"content":"A"}', '{"content":"B"}') // true  —— 真实改变
```

两个方向都由 `tests/discrimination.mjs` 覆盖。

需要**检查内部表征**的属性一律标为 **`not-assessable`**，不做猜测，也不计入达成数：

- `HOT-1` —— 知觉是否为生成式 / 自上而下？
- `HOT-4` —— 编码是否稀疏平滑、构成性质空间？
- `AST-1` —— 系统是否真的维护关于自身注意状态的预测模型？

`AST-1` 无法评估，正是**本工具事实上给不出 L5** 的原因，这是刻意设计。文字轨迹回答不了这些问题，
假装能回答的工具只是在做戏。

## 安装

支持两条路径，**优先推荐 npm**——用户装到的是预构建产物，完全不需要任何构建放行。
Git 路径留给想跟着源码走的人，代价是一次显式放行；见本节末尾。

### npm（推荐）

```sh
dsh plugin --profile my-profile add @slatinwine/dsh-sentience-audit
dsh --profile my-profile --dump-config     # 确认 sentience-audit 这一行存在
```

发布的 tarball 内已含 `lib/`，用户机器上不构建任何东西。包内声明了 **`dsh.bundle.patch`**，
这正是 `dsh plugin add` 会贡献组合层、而不是仅装一个依赖的原因——缺该声明的包会**静默装上且不添加任何行**，
所以这一步值得在 `--dump-config` 里核对。

不想用 registry 的话，tarball 方式等价：

```sh
npm pack                                   # 作者侧，在包目录内执行
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
```

### 从 Git 安装（源码路径，需显式放行）

```sh
dsh plugin --profile my-profile add github:slatinwine/dsh-sentience-audit#<sha>
```

Git 安装取到的是**源码而非构建产物**，而 pnpm ≥ 10 在显式放行前拒绝运行依赖的构建脚本。
首次 `add` 会失败，并打印需要复制进 profile 的 `pnpm-workspace.yaml` 的包名键：

```yaml
allowBuilds:
  '@slatinwine/dsh-sentience-audit': true
```

然后重跑 `add`。**请把这次放行理解为「允许该包在安装时于你机器上执行代码」**，
它运行在 agent 所用沙箱之外——这正是运行 `prepare` 的含义。建议钉住 commit（`#<sha>`），
以免之后一次 push 悄悄改变实际执行的内容。本包的 `prepare` 是自包含的
（两次 `tsc` 加一次声明文件改写，`typescript` 在 `devDependencies` 里），不会访问包外内容。

### Host 面与 Client 面

**Host 面** —— 上面那行就是 bundle 提供的内容。若只想让单个会话获得该工具，把同一行放进预设：

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

插件声明 `inject: ['sessions']`，并以可选方式读取 `tools` 与 `agents`。若部署没有工具注册表，
它不贡献任何东西，也不会让挂载失败。

**Client 面** —— 浏览器面板是同包的另一份构建产物。其 `package.json` 携带 `dsh.client` 声明，
因此会扫描客户端包的部署会像对待官方 UI 包一样发现并托管它；面板渲染在最新的 `cordis_run` 卡片内。
面板向 Host 请求审计结果，所以浏览器视图与模型可见的工具输出不可能不一致。

## 使用

模型调用 `sentience_audit` 工具：

```
sentience_audit()                       # 审计当前会话
sentience_audit({ sessionId: "..." })   # 审计另一段实时会话
```

或以代码调用：

```ts
import { assess } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)   // 3, 'L3 · 全局工作空间'
```

## 等级

等级是**硬门槛，不是加权平均**。每一级都点名了支撑它的具体指标，因此无法靠堆砌无关的满足项升级。

| 等级 | 含义 | 硬门槛 |
| --- | --- | --- |
| **L1** | 无任何属性成立 | — |
| **L2** | 递归回路：信息能回流、目标能被追求 | `RPT-1`、`AE-1`，2 族，≥2 项 |
| **L3** | 功能化全局工作空间 | `RPT-1`、`GWT-1`、`GWT-2`、`GWT-4`、`AE-1`，3 族，≥6 项 |
| **L4** | 可验证的元认知监控 | `GWT-4`、`HOT-2`、`HOT-3`、`PP-1`、`AE-2`，4 族，≥8 项 |
| **L5** | 注意图式与预测编码 | 六族全立，≥11 项，含 `AST-1` |

工具丰富、会写文件、会读回、会从失败中改变策略的 harness，通常落在 **L2–L3**。
对一个注意图式无法从文字轨迹验证的架构来说，这就是诚实的天花板。

## 导出

| 入口 | 内容 |
| --- | --- |
| `.` | Cordis Host 插件（`name`、`inject`、`apply`）加上审计引擎：`assess`、`auditSession`、`auditEvents`、`RUBRIC`、`LEVELS`、`REQUIREMENTS`、`DISCLAIMER`、`renderMarkdown` 及结果类型 |
| `./client` | 浏览器面板（已构建产物） |

## 开发

```sh
npm install
npm run build            # 编译 Host（tsconfig.json）与 Client（tsconfig.client.json）
npm run typecheck        # 两半边类型检查，不产出
npm test                 # 引擎不变量 + 运行时契约验证
npm run test:vitest      # 同一套引擎用例改用 Vitest 运行
```

`npm test` 跑两个套件：

- **`tests/run.ts`** —— 引擎不变量（29 条断言），其中最关键的一条是：纯文字轨迹必须判为 L1、满足指标为 0。
- **`tests/contract.mjs`** —— 针对**已构建**的 `lib/` 运行，因此走的是真实的 `defineTool` DSL 校验器与真实模块图：
  schema 在运行时被接受、工具能对假会话跑通完整审计、会话解析支持显式 id 与执行中的 agent、
  两者都没有时给出可读错误，`apply()` 能经工具注册表注册并在没有注册表时安全降级。

源码之间用显式 `.ts` 扩展名互相引用，因此能用 `node --experimental-strip-types` 直接运行。
`tsc` 的 `rewriteRelativeImportExtensions` 会把说明符在**JavaScript** 产物里改写为 `.js`，
但**不会**处理生成的 `.d.ts`，所以 `scripts/fix-declarations.mjs` 对 `lib/types/**` 做同样的改写。
少了这一步，发布出去的声明文件会指向 `./core/types.ts`，消费者的 TypeScript 无法解析；
而这个破损在 `skipLibCheck` 打开时完全看不出来——正是因为如此，构建必须自己做改写，而不是依赖它。

两个套件都不依赖测试框架，因此在受限环境里也能跑；`test:vitest` 供正常 shell 使用。

`prepack` 会自动构建，所以 `npm publish` 不会发出过期或缺 `lib/` 的包。

## 局限

- **只基于轨迹。** 需要内部表征的项一律 `not-assessable`。
- **只支持实时会话。** `sessions` 服务持有的是实时会话，已归档的会话无法经它读取。
- **是代理量，不是属性本身。** 「模块切换」是「依次查询专门模块」的可观测代理，不等于证明全局工作空间存在。
- **量表是暂定的。** 作者明确表示指标清单会随研究进展而变。本包锁定 2023 年 Table 1 版本，并在每次结果中标注出处。

## 许可

MIT。量表和属性原文出自上述报告，该报告采用
[CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) 许可，具体条款见报告。
