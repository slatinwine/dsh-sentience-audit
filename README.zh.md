# dsh-sentience-audit

[![CI](https://github.com/slatinwine/dsh-sentience-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/slatinwine/dsh-sentience-audit/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

按 Butlin、Long、Elmoznino、**Bengio** 等 (2023) 提出的 **14 项意识指标属性**，审计
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 会话轨迹，输出 **L1–L5** 等级与逐条证据。

> **这不是意识测量仪。** 原报告的结论就是 *no current AI systems are conscious*，并且明确警告行为证据
> 不可靠——系统可以模仿行为而运作方式完全不同。L1–L5 应读作 *「该轨迹在多大程度上实现了这些理论所关联的
> 功能组织」*，它是**候选资格的代理指标，不是体验的测量**。

**第一次用？** 请看 [`GETTING-STARTED.zh.md`](./GETTING-STARTED.zh.md)（English: [`GETTING-STARTED.md`](./GETTING-STARTED.md)）。
**看一份真实报告：** [`docs/EXAMPLE-REPORT.md`](./docs/EXAMPLE-REPORT.md)。
**贡献代码：** [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

- **评分依据：**[Consciousness in Artificial Intelligence: Insights from the Science of Consciousness](https://arxiv.org/abs/2308.08708)
  （arXiv:2308.08708）Table 1，14 项指标属性，来自递归加工、全局工作空间、计算高阶理论、注意图式、
  预测加工、能动与具身六套理论。
- **方法：** 确定性计算，且与平台无关。不调用模型、不使用 LLM 裁判、不联网。同一份事件日志
  在任何系统上永远得到同一结果，因此分数可复算、可 diff。
- **诚实的上限：** 有三项属性无法从文本轨迹回答，一律记为「无法评估」而非猜测。`AST-1` 是
  L5 的门槛，所以本工具实际上给不出 L5。

## 为什么判定只看结构

更早的版本曾从模型的**措辞**里给指标打分——数「假设」「验证」这类词。那衡量的是词汇量而不是
架构，而且全面抬分：一段只是在*讨论*意识的轨迹，会被算成*表现出*了意识。

因此本包只读取**可复放的轨迹结构**——后来的调用是否消费了先前结果给出的路径、会话是否写过
文件又读回、失败后是否真正换了思路。分数因此可复算、可 diff。

需要**检查内部表征**的属性一律记为**「无法评估」**而不是猜测，并不计入达成数：

- `HOT-1` —— 知觉是否生成式 / 自上而下？
- `HOT-4` —— 编码是否稀疏平滑、构成质量空间？
- `AST-1` —— 系统是否真的维持自身注意力的预测模型？

`AST-1` 无法评估，正是**本工具实际上到不了 L5** 的原因，这是有意的。文本轨迹回答不了这些
问题，假装能回答的工具只是在演戏。

## 安装

包**还没有发布到 npm**，因此请安装发布压缩包（内含编译好的 `lib/`，你的机器上无需构建）：

```sh
# 从 https://github.com/slatinwine/dsh-sentience-audit/releases/latest
# 下载 slatinwine-dsh-sentience-audit-0.1.1.tgz，然后
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.1.tgz
dsh --profile my-profile --dump-config     # 确认出现 sentience-audit 行
```

完整流程——包括核对安装、排错与卸载——见 [`GETTING-STARTED.zh.md`](./GETTING-STARTED.zh.md)。

## 使用

模型调用 `sentience_audit` 工具：

```
sentience_audit()                       # 审计当前会话
sentience_audit({ sessionId: "..." })   # 审计另一段活跃会话
```

结果（节选）：

```
## 意识指标审计 · L3 · 全局工作空间
达成 8 · 无法评估 3 · 缺失 3 · 指标族 3/6 · 置信带 中
...
| 指标 | 判定 | 证据类型 | 轨迹证据 / 原因 |
| RPT-1 输入模块采用算法递归 | 达成 | 架构既定 | 工具调用 65 次 / 涉及轮次 1 / 步内回流 59 次 |
| HOT-1 生成式 / 自上而下 / 带噪的知觉模块 | 无法评估 | 轨迹结构 | 需要检查输入模块内部… |
```

同一份结果会在工具卡片内渲染为结构化面板。

## 等级

等级是**门槛制，不是平均制**。每一级都点名了携带它的具体属性，堆砌无关的达成项升不了级。

| 等级 | 含义 | 硬门槛 |
| --- | --- | --- |
| **L1** | 无属性成立 | — |
| **L2** | 递归回路：信息回流，目标被持续追求 | `RPT-1`、`AE-1`，2 个指标族，≥2 项达成 |
| **L3** | 功能性全局工作空间 | `RPT-1`、`GWT-1`、`GWT-2`、`GWT-4`、`AE-1`，3 个指标族，≥6 项达成 |
| **L4** | 可验证的元认知监控 | `GWT-4`、`HOT-2`、`HOT-3`、`PP-1`、`AE-2`，4 个指标族，≥8 项达成 |
| **L5** | 注意图式 + 预测编码 | 全部六个指标族，≥11 项达成，含 `AST-1` |

一个工具齐全、会写文件、会读回来、会从失败中恢复的 Harness 会话，通常落在 **L2–L3**。对于
注意力图式无法从轨迹验证的架构，这就是诚实的上限。

## 局限

- **只基于轨迹。** 凡是需要内部表征的内容，一律「无法评估」，这是设计使然。
- **只支持活跃会话。** `sessions` 服务保存的是活跃会话；归档会话无法通过它读取。
- **是代理指标，不是属性本身。** 「模块切换」是专门模块被相继查询的可观测代理，不是全局
  工作空间存在的证明。
- **量规是临时性的。** 原作者声明指标清单会随研究演进。本包固定在 2023 年 Table 1 版本，
  并在每份结果中注明出处。

## 许可

MIT。评分量规与引用的属性措辞来自上述报告，采用
[CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) 许可；条款见原报告。
