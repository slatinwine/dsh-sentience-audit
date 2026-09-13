# v0.1.0 —— DeepSeek Harness 意识指标审计

按 Butlin、Long、Elmoznino、**Bengio** 等 (2023) 提出的 **14 项意识指标属性**，审计
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 会话轨迹，输出 **L1–L5** 等级与逐条证据。

English: [`RELEASE-NOTES-v0.1.0.md`](https://github.com/slatinwine/dsh-sentience-audit/blob/main/docs/RELEASE-NOTES-v0.1.0.md)

---

> ### 这不是意识测量仪
>
> 原报告的结论就是 *"no current AI systems are conscious"*，并且明确警告行为测试不可靠——
> 系统可以模仿行为而运作方式完全不同。L1–L5 应读作 *「该轨迹在多大程度上实现了这些理论所关联的功能组织」*。
> 它是**候选资格的代理指标，不是对体验的测量**。

---

## 输出长什么样

下面是一份真实报告，数字未作修饰（[完整拆解](https://github.com/slatinwine/dsh-sentience-audit/blob/main/docs/EXAMPLE-REPORT.md)）：

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高

**指标族** 递归加工 RPT 2/2 OK · 全局工作空间 GWT 4/4 OK · 高阶表征 HOT 2/4 OK ·
注意图式 AST 0/1 -- · 预测加工 PP 1/1 OK · 能动与具身 AE 2/2 OK
```

| 指标 | 判定 | 证据类型 | 轨迹证据 |
| --- | --- | --- | --- |
| GWT-4 状态依赖注意 | 达成 | 轨迹结构 | 依赖链 103 次 / 模块切换 132 次 |
| HOT-2 元认知监控 | 达成 | 轨迹结构 | 工具错误 17 次 / 其中改变策略 17 次 |
| AST-1 注意状态的可预测模型 | **无法评估** | 轨迹结构 | 需要确认系统是否真的维护该模型——文字轨迹给不出答案 |

## 要点

**确定性。** 不调用模型、不使用 LLM 裁判、不联网。同一份事件日志永远得到同一结果，因此分数可复算、可 diff。

**判定只看结构，绝不看措辞。** 早期版本统计「假设」「验证」这类词，把一段仅仅**讨论**意识的轨迹判成 14 项中 11 项满足。
现在的信号全部来自可复算的轨迹结构：相邻调用之间的参数承接、模块族切换、失败后真正改变做法、以及产物写出后再被读回。

**诚实的天花板。** 有三项属性需要检查内部表征，而文字轨迹给不出：知觉是否生成式（`HOT-1`）、
编码是否稀疏平滑（`HOT-4`）、系统是否维护关于自身注意状态的模型（`AST-1`）。
它们被标为 **无法评估**而非猜测，且不计入达成数。由于 `AST-1` 卡住 L5，**本工具事实上给不出 L5**。这是刻意的。

**区分「真恢复」与「机械重试」。** 两次调用在**键排序后结构相等**时视为同一次尝试，
所以键序被重排的重新序列化不算新做法；无法解析的参数回退比较**内容重合度**，绝不比较共享词汇。

**跨平台**，且在真实 runner 上验证过：Windows、macOS、Linux。
大小写仅对**形如 Windows 的路径**折叠，因此 POSIX 会话保持大小写敏感；
`pwsh`/`powershell`/`bash`/`sh`/`zsh`/`dash` 视为同一 shell 族；读回探针同时覆盖 PowerShell 与 POSIX 动词。
约定**从路径自身形态推断**，而非读 `process.platform`——这样分数是事件日志的纯函数，在任何主机上完全一致。

## 安装

**从本 release 安装（不需要 npm 账号，也不需要构建放行）：**

```sh
# 下载下方附件里的 .tgz，然后
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
dsh --profile my-profile --dump-config     # 确认 sentience-audit 这一行存在
```

tarball 内已含构建好的 `lib/`，你机器上不编译任何东西。

**从源码安装**（需要在 profile 的 `pnpm-workspace.yaml` 里写一次 `allowBuilds` 放行）：

```sh
dsh plugin --profile my-profile add github:slatinwine/dsh-sentience-audit#v0.1.0
```

本地覆盖层方式、层序优先级与五类失败模式见
[`GETTING-STARTED.zh.md`](https://github.com/slatinwine/dsh-sentience-audit/blob/main/GETTING-STARTED.zh.md)。

## 使用

对 agent 说，或直接调用：

```
sentience_audit()                       # 审计当前会话
sentience_audit({ sessionId: "..." })   # 审计另一段实时会话
```

也可以纯代码调用——引擎就是普通导出，不需要实时会话：

```ts
import { assess, renderMarkdown } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)
```

## 等级

**硬门槛，不是加权平均**——每一级都点名支撑它的具体指标，无法靠堆砌无关的满足项升级。

| 等级 | 含义 | 硬门槛 |
| --- | --- | --- |
| **L1** | 无任何属性成立 | — |
| **L2** | 递归回路：信息能回流、目标能被追求 | `RPT-1`、`AE-1`，2 族，≥2 项 |
| **L3** | 功能化全局工作空间 | `RPT-1`、`GWT-1`、`GWT-2`、`GWT-4`、`AE-1`，3 族，≥6 项 |
| **L4** | 可验证的元认知监控 | `GWT-4`、`HOT-2`、`HOT-3`、`PP-1`、`AE-2`，4 族，≥8 项 |
| **L5** | 注意图式与预测编码 | 六族全立，≥11 项，含 `AST-1` |

工具丰富的编码会话通常落在 **L2–L3**。而一个「用来改进这个工具本身」的会话会拿更高分，
因为读回自己的产物正是 `PP-1`、`AE-2`、`RPT-2` 最爱的信号——所以**不要把上面的示例当作基线**。

## 验证

| | |
| --- | --- |
| 测试套件 | 4 套 |
| 断言总数 | 97 条 |
| CI | Ubuntu、macOS、Windows × Node 22、24 —— 全绿 |
| 每格任务 | 类型检查、测试、产物校验、以及把打好的 tarball 装进临时目录 |

这里的每一项声明背后都有一次真实运行。发布的 `lib/` 是编译后的 JavaScript，只需 Node ≥ 20；
测试套件是 TypeScript 由 Node 直接执行，需要 ≥ 22.18.0。

## 量表出处

14 项属性与各级硬门槛遵循 **Table 1**：Butlin, Long, Elmoznino, Bengio, Birch, Constant, Deane,
Fleming, Frith, Ji, Kanai, Klein, Lindsay, Michel, Mudrik, Peters, Schwitzgebel, Simon & VanRullen (2023),
*Consciousness in Artificial Intelligence: Insights from the Science of Consciousness*
（[arXiv:2308.08708](https://arxiv.org/abs/2308.08708)）——来自递归加工、全局工作空间、计算高阶理论、
注意图式、预测加工、能动与具身六套理论。每次结果都会标注该出处。

原报告明确表示量表是暂定的；本版本锁定 2023 年修订版。

## 关于工具本身的常见疑问

**为什么给不出 L5？** `AST-1` 需要确认系统真的维护关于自身注意状态的预测模型。文字轨迹无法证明这一点，
所以它被判为「无法评估」，而 L5 以它为门槛。声称能做到的工具只是在做戏。

**拿到高等级是否说明模型有意识？** 不是。它只说明该轨迹在「这些理论所关联的功能组织」上表现完整。
原报告的结论就是：现有 AI 系统没有一个是候选。

**为什么 `HOT-1` 是「无法评估」而不是「缺失」？** 这是两种不同的结论。「无法评估」是说轨迹答不了这个问题，
「缺失」是说明确没有表现出来。`HOT-1` 问的是知觉是否生成式——那是内部机制的问题，不在轨迹的记录范围内。

---

**完整文档：** [README](https://github.com/slatinwine/dsh-sentience-audit/blob/main/README.zh.md) ·
[快速上手](https://github.com/slatinwine/dsh-sentience-audit/blob/main/GETTING-STARTED.zh.md) ·
[示例报告](https://github.com/slatinwine/dsh-sentience-audit/blob/main/docs/EXAMPLE-REPORT.md) ·
[贡献指南](https://github.com/slatinwine/dsh-sentience-audit/blob/main/CONTRIBUTING.md) ·
[变更日志](https://github.com/slatinwine/dsh-sentience-audit/blob/main/CHANGELOG.md)

MIT 许可。
