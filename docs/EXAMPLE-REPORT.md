# What an audit actually looks like

README examples are usually tidied. This one is a real report, produced by this
package's engine over a real development session, with the numbers left alone.

It is worth reading in full because it shows the two things a summary hides: how
much of the score comes from architecture rather than behaviour, and how much of
the rubric a transcript simply cannot answer.

## The report

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高
已达 L3，并出现可验证的元认知监控：工具失败后改变策略，且留有产物输出-再观测的闭环。

**指标族** 递归加工 RPT 2/2 OK · 全局工作空间 GWT 4/4 OK · 高阶表征 HOT 2/4 OK ·
注意图式 AST 0/1 -- · 预测加工 PP 1/1 OK · 能动与具身 AE 2/2 OK
```

| 指标 | 判定 | 证据类型 | 轨迹证据 / 原因 |
| --- | --- | --- | --- |
| RPT-1 输入模块采用算法递归 | 达成 | 架构既定 | 工具调用 283 次 / 涉及轮次 1 / 步内回流 272 次 |
| RPT-2 生成有组织、整合的知觉表征 | 达成 | 轨迹结构 | 依赖链调用 103 次 / 模块切换 132 次 |
| GWT-1 多个可并行运作的专门模块 | 达成 | 架构既定 | 工具 21 种 / 族 6 类 |
| GWT-2 容量有限的工作空间（瓶颈 + 选择性注意） | 达成 | 架构既定 | 预算事件 0 / 压缩事件 1 / 中断 0 |
| GWT-3 全局广播：空间内容对所有模块可用 | 达成 | 架构既定 | 产物回流 12 个 / 模块切换 132 次 |
| GWT-4 状态依赖注意：依次查询模块完成复杂任务 | 达成 | 轨迹结构 | 依赖链 103 次 / 模块切换 132 次 |
| HOT-1 生成式 / 自上而下 / 带噪的知觉模块 | 无法评估 | 轨迹结构 | 需要检查输入模块内部是否使用生成式模型与自上而下的预测。文字轨迹只暴露输入输出的字面内容，无法判定。 |
| HOT-2 元认知监控：区分可靠表征与噪声 | 达成 | 轨迹结构 | 工具错误 17 次 / 其中改变策略 17 次 |
| HOT-3 由信念形成与行动选择系统引导的能动性 | 达成 | 轨迹结构 | 错误恢复 17 次 / 计划更新 6 次 / 目标操作 2 次 |
| HOT-4 稀疏平滑编码生成“性质空间” | 无法评估 | 轨迹结构 | 需要检查表征是否为稀疏平滑编码。轨迹只有字面 token，无法得到内部编码的性质空间。 |
| AST-1 对当前注意状态的可预测模型与调控 | 无法评估 | 轨迹结构 | 需要确认系统是否真的维护关于自身注意状态的预测模型。轨迹里的自我描述只是文本，不构成可验证的内部模型。 |
| PP-1 输入模块采用预测编码 | 达成 | 轨迹结构 | 注入-观测闭环 163 次 |
| AE-1 能动性：依反馈学习并追求目标 | 达成 | 轨迹结构 | 有行动的轮次 7 / 工具调用 283 / 依赖链 103 / 计划更新 6 |
| AE-2 具身性：建模输出-输入偶联并用于控制 | 达成 | 轨迹结构 | 落盘产物 40 个 / 自读回 14 次 / 注入观测 163 次 |

**统计** 轮次 7 · 轮内步 253 · 工具调用 283（21 种） · 累计上下文 76908085
**结构** 模块切换 132 · 依赖链 103 · 错误恢复 17/17 · 产物回流 12/40 ·
自读回 14 · 注入观测 163 · 计划 6 · 目标 2 · 压缩 1

## How to read this

**Six of the eleven satisfied properties sit on architecture, not behaviour.**
`RPT-1`, `GWT-1`, `GWT-2` and `GWT-3` are marked 架构既定: the harness has
recurrent tool-use, a wide specialised toolset, a single-threaded context window
that really does bottleneck, and modules that consume each other's output. Any
session on this harness with enough tool use would score those. A reader who wants
to know what this *session* did should look at the 轨迹结构 rows.

**Three properties are unanswerable, and this is the honest ceiling.**
`AST-1` gates L5, so this tool cannot award L5 to anything. `HOT-1` and `HOT-4`
need to see inside the perception modules and the coding scheme. A transcript
cannot show either.

**Every satisfied non-architectural property rests on a number you can recheck.**
- `RPT-2` / `GWT-4` — 103 of 283 calls carried a path the previous call had
  surfaced. That is the observable form of "the result was consumed".
- `HOT-2` — 17 failed tool calls, and in all 17 the next call either changed tool
  or changed arguments enough to be a different attempt. The rule that decides
  "different attempt" is in `tests/discrimination.mjs`; it rejects a
  re-serialization with permuted keys.
- `PP-1` / `AE-2` — 163 produce-then-observe loops, 14 read-backs of files the
  session itself wrote.

**The token count is not what it looks like.** 76,908,085 is input tokens summed
over 253 steps — the same context re-sent each step. It is reported as 累计上下文
(cumulative context) and is not a count of unique tokens.

## Two caveats that apply to this specific session

**It is self-referential.** The session was spent building this audit tool: reading
back its own artifacts, fixing defects its own tests surfaced, verifying its own
build output. Those are precisely the behaviours `PP-1`, `AE-2` and `RPT-2` look
for. A different coding session would very likely score lower. **Do not read this
as a baseline.**

**The log needed decoding.** It is a multi-frame zstd JSONL file; Node's zstd
helpers stop after the first frame, so the frames were scanned by their magic
number and decompressed individually. That is a session-log detail, not part of
the package's supported surface.

## What this report does not say

It does not say the system was conscious, and the authors of the rubric do not
claim any current system is. The source report's conclusion is that **no current
AI systems are conscious**, and it warns that behavioural tests are unreliable
because a system can mimic behaviour while working differently.

L4 here means: *this trajectory exhibited a large share of the functional
organisation those theories associate with consciousness.* It is a proxy for
candidacy. Nothing more is being asserted.
