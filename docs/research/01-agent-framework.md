# Agent Framework：从单 Agent 工具循环到可治理的多 Agent 底座

## 为什么要做

Vela 要解决的不是“让模型回复一句话”，而是让 Agent 可以在真实业务系统里持续运行：它要读上下文、调用工具、写事件、暂停等待用户、恢复执行、进入沙箱、访问知识、触发记忆、对接外部 Agent。单纯把这些能力塞进一个聊天接口，会很快失去治理边界。

因此项目需要一个 Agent Framework。这个 Framework 的价值不是制造一堆角色名，而是定义哪些能力属于业务控制面，哪些能力属于模型执行面，哪些能力应该通过协议、工具、Skill、记忆和知识系统扩展。

## 要解决的问题

Vela 面对的核心问题是 Agent 执行过程天然不确定，而业务系统必须确定。模型可能多次调用工具，工具可能失败，用户可能中途取消，远端 Agent 可能需要 handoff，代码执行必须隔离，长期记忆不能被 prompt injection 污染。

Framework 要把这些不确定行为包进清晰边界：业务态由 Biz 维护，执行态由 Engine 运行，事件由 durable event 保存，工具由 Registry 约束，跨 Agent 调用由 handoff 工具表达，平台治理由配置、审计和策略兜底。

## 设计目标

第一，Agent 要能在多 Turn 会话中持续工作，而不是一次性请求响应。第二，Agent 能力要可扩展，MCP、Skill、A2A、Sandbox 都不能写死在主循环里。第三，副作用必须可审计，包括工具执行、记忆写入、文件产物和远端代理调用。第四，失败要能收敛，不能因为一次模型或工具异常导致系统状态不可恢复。

## 核心思想

Vela 当前更像“单 Agent 主循环 + 可插拔能力层 + 受控 handoff”的框架，而不是已经完整落地的 Supervisor/Planner/Worker 多 Agent 图运行时。

Supervisor 在源码里不是一个独立智能体，而是由 Biz、Engine 启动接口、租约、状态机和 reaper 共同形成的运行监管能力。Router 更多体现为模型候选、工具 allowlist、协议 provider 和 MCP/A2A provider 的路由，而不是一个对话内 Router Agent。Planner 主要体现在研究模式和模型规划能力中，还没有形成通用规划器。Worker 一部分是 Celery 异步任务，一部分是远端 A2A handoff 的目标 Agent。

## 架构设计

Framework 可以理解为四层：

- 控制层：`backend/biz` 负责会话、Turn、用户、项目、事件、回调、审批、平台能力管理。
- 执行层：`backend/engine` 负责上下文构建、模型调用、Agent Loop、工具执行、沙箱、协议事件输出。
- 能力层：Tool、MCP、Skill、Knowledge、Memory、Sandbox、A2A 都作为可插拔能力进入执行层。
- 后台治理层：`backend/workers` 处理标题生成、记忆提取、知识索引、审计、usage、Turn reaper。

这说明作者更关注运行边界，而不是在代码里堆砌 Agent 角色。

## 为什么这样设计

如果把所有 Agent 能力都放进一个服务，业务状态、模型执行、工具副作用和用户权限会互相污染。Vela 把 Biz 和 Engine 拆开，等于把“谁可以发起、谁拥有状态”和“谁负责执行、谁消耗模型与工具”分离。

这种设计适合多租户平台，因为平台要控制用户、项目、会话、审计和额度，而 Engine 可以专注于模型运行和能力编排。将 Tool、Skill、MCP、A2A 抽象成 provider 或 registry，也让未来替换协议和接入新能力时不需要重写主循环。

## 项目体现

源码中可以看到这些设计事实：

- `backend/biz/services/turn_service.py` 负责 Turn 提交、取消、继续、编辑重发、恢复中断，说明业务态由 Biz 控制。
- `backend/engine/api/internal/turns.py` 负责启动执行、抢占 Turn、构建 Agent Loop、装载工具和 provider，说明执行态集中在 Engine。
- `backend/engine/loop/agent_loop.py` 是主执行循环，承载模型、工具、观察、暂停和完成。
- `backend/engine/agents` 与 `backend/engine/tools/handoff.py` 已支持把远端 Agent 暴露成 handoff 工具，但没有完整 Supervisor/Worker 图运行时。
- `backend/engine/skills`、`backend/engine/tools`、`backend/engine/sandbox`、`backend/engine/providers` 体现能力插件化。

## Trade-off

这种设计的好处是边界清晰，坏处是链路更长。一次用户消息会经过 Biz 写事件、Engine 执行、EventBus 输出、Redis Stream 转发、Biz 回调、Workers 后处理。系统复杂度明显高于单体聊天服务。

另一个取舍是当前多 Agent 能力采用 toolized handoff，而不是完整的 Supervisor 编排图。这样更容易落地和治理，但表达复杂多 Agent 协作时能力有限。

## 优点

它把 Agent 平台最危险的部分拆开了：模型不直接拥有业务状态，工具不绕过 registry，代码不在本地运行，远端 Agent 不直接接管主会话。即使模型行为不稳定，系统仍有状态机、事件日志、租约和策略约束。

这种设计也利于演进。MCP、Skill、A2A、Nacos provider 都可以在不大改 Agent Loop 的前提下扩展。

## 缺点

Framework 的概念层还没有完全产品化。Supervisor、Router、Planner、Worker、Reflection、Memory 这些术语不是全部都有一一对应的独立运行实体。有些能力是由多个模块共同形成的工程效果，而不是一个清晰的 Agent 角色。

这会让外部读者容易误解：以为 Vela 已经有完整多智能体框架，但源码体现的是单 Agent 主循环先稳定，再通过 handoff 和 provider 逐步扩展。

## 可以如何优化

未来可以把多 Agent 能力进一步显式化：定义 Supervisor 运行模型、子任务生命周期、远端 Agent 流式回传、跨 Agent 取消、上下文裁剪和权限传递。Planner 也可以从研究模式里抽象出来，变成通用计划生成和执行检查能力。

Memory 和 Reflection 也值得从主循环副作用中独立成治理层，例如给记忆写入、反思总结、失败归因、计划修订建立统一事件模型。

## 工程经验

Agent Framework 的关键不是有多少角色名，而是每个能力有没有边界。Vela 的经验是先把 Turn、Event、Tool、Sandbox、Skill、Provider 这些基础边界打稳，再谈复杂多 Agent。

在真实系统里，Agent 角色不是越多越好。角色越多，状态同步、权限传递、失败恢复和成本控制越复杂。

## 踩坑总结

不要把远端 handoff 等同于完整多 Agent Runtime。当前 Vela 已经有 Agent Registry 和 handoff 工具，但还没有完整的 Supervisor/Planner/Worker 图执行闭环。

不要把 Router 理解成一个必须存在的智能体。源码里更多是工程路由：模型路由、工具路由、协议 provider 路由和能力开关。

## 值得分享的观点

一个成熟 Agent Framework 的第一步，不是让多个 Agent 彼此对话，而是让单个 Agent 的执行过程可恢复、可审计、可限制、可扩展。没有这些基础，多 Agent 只会放大混乱。

## 一句话总结

Vela 当前的 Agent Framework 是以单 Agent 可靠执行为核心、以工具和协议扩展多 Agent 能力的工程底座。
