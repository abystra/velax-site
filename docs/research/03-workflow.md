# Workflow：状态机、事件图与 LangGraph 思想的工程化取舍

## 为什么要做

Agent 系统不能只依赖一次请求响应。它需要描述任务如何开始、如何等待、如何恢复、如何取消、如何超时、如何记录中间结果。Workflow 的意义就在于把运行过程显式化。

Vela 当前没有完整的通用 Graph Workflow Runtime，但它已经具备很多图式工作流思想：状态机、事件日志、上下文快照、工具循环、人工中断和后台 reaper。

## 要解决的问题

传统线性流程适合确定步骤，例如 A 完成后执行 B。但 Agent 任务经常出现运行时决策：模型是否需要工具、工具是否需要审批、用户是否中断、上下文是否需要压缩、远端 Agent 是否返回 input_required。

Workflow 要解决的是“不确定路径如何被系统接住”。即使没有完整 Graph Runtime，也要保证状态转移合法，事件顺序可追踪，恢复时能重建上下文。

## 设计目标

Vela 的当前目标不是先实现一个复杂图引擎，而是先把 Turn 生命周期跑稳。状态机负责边界，事件日志负责事实，Agent Loop 负责动态决策，后台任务负责异步收尾。

这种设计的目标是最小可行的可靠编排：能等待、能恢复、能取消、能超时、能重新生成、能从 durable events 投影前端状态。

## 核心思想

Workflow 在 Vela 中表现为“状态机 + 事件流 + 循环执行”的组合。状态机定义合法阶段，事件流记录实际发生的内容，Loop 根据模型与工具结果决定下一步。

这和 LangGraph 的思想有相通之处：对话线程需要持久状态，节点之间需要 checkpoint，工具调用需要可恢复，人类输入是图中的等待点。但 Vela 没有直接把 LangGraph 作为运行时依赖，也没有暴露通用 Node/Edge/Graph DSL。

## 架构设计

可以把当前 Workflow 看成三条线：

- 控制状态线：Turn 从 pending 进入 building、calling、streaming、executing、waiting_input，最终进入 completed、failed、cancelled 或 timeout。
- 事件事实线：用户消息、助手文本、推理、工具调用、工具结果、产物、retrieved context、状态增量和 run terminal 都写入 durable events。
- 执行决策线：Agent Loop 在模型输出和工具观察之间循环，必要时进入人工输入等待。

Graph 的思想体现在这些线之间的关系，而不是一个独立图引擎。

## 为什么这样设计

直接上通用 Graph Runtime 会增加抽象复杂度。Vela 当前更需要稳定的会话、事件、工具、沙箱和协议链路，所以先选择了状态机和事件日志这两个更基础的工程抽象。

这种设计避免了为了“看起来像图”而牺牲落地速度。对于大多数对话式 Agent，模型工具循环已经能覆盖主要需求；只有当多步骤任务、研究流程和多 Agent 协作复杂到一定程度时，通用图才会变得必要。

## 项目体现

源码中能看到这些体现：

- `backend/biz/domain/turn_state.py` 给出了明确的 Turn 状态与终态。
- `backend/biz/services/turn_service.py` 通过事件序列支持提交、取消、继续、编辑重发、重新生成和恢复中断。
- `backend/engine/eventbus` 把运行输出写成可投影的事件流。
- `backend/biz/services/agui_projection.py` 从 durable events 重建前端消息和状态。
- `backend/workers/tasks/turn_reaper.py` 对过期租约和陈旧非终态 Turn 做收敛。

未完整体现的是：通用 Node、Edge、Condition、Graph 定义与执行器。

## Trade-off

状态机加事件流比通用图更简单、可靠，也更贴近当前需求。但它表达复杂流程的能力较弱，例如并行分支、条件合并、子图重试、人工审批节点复用、长周期计划调度等，都需要额外抽象。

通用图可以提升表达力，但也会带来调试成本、状态迁移成本和用户理解成本。Vela 当前选择先把底层执行可靠性做好。

## 优点

这种做法让系统先拥有了工作流最关键的可靠性：状态可控，事件可追溯，恢复有依据，终态能收敛。它比直接堆模型 prompt 更接近生产系统。

它还让前端协议层受益。因为事件是事实源，AG-UI snapshot 和 state delta 可以从历史事件重建，而不是依赖 Engine 内存。

## 缺点

缺少通用 Graph Runtime 意味着复杂任务的结构表达还不够强。研究任务、文档生成、多 Agent 协作等场景如果继续增长，单纯依靠 Agent Loop 和零散状态会变得难维护。

当前 Workflow 更多是运行时事实，而不是可视化、可配置、可调度的工作流产品能力。

## 可以如何优化

未来可以在现有 Turn 和 Event 之上引入轻量 Graph 层。节点可以复用模型调用、工具执行、人工输入、沙箱任务、远端 Agent handoff；边可以表达条件、重试、超时和分支合并。

关键是不要绕开当前 durable events。Graph Runtime 应该把节点执行结果继续写成统一事件，而不是另起一套状态事实源。

## 工程经验

Graph 不是从“画节点”开始的，而是从“状态能不能恢复”开始的。Vela 的路径比较务实：先有 Turn 状态机、事件流、租约和 reaper，再考虑更高级的图编排。

如果没有持久事件和终态收敛，图引擎只会把不可恢复的问题包装得更复杂。

## 踩坑总结

不要把 Agent Loop 误认为完整 Workflow，也不要把状态机误认为 Graph。Vela 当前有图式思想，但没有通用图执行器。

另一个坑是人工中断。Human In Loop 不是弹一个 UI 卡片这么简单，它必须成为状态机的一部分，否则恢复时上下文和权限都会出问题。

## 值得分享的观点

LangGraph 的价值不只是 Graph，而是把 LLM 应用当作有状态、可恢复、可中断的系统来设计。Vela 虽然没有直接使用 LangGraph Runtime，但在事件事实源和等待恢复上体现了同类思想。

## 一句话总结

Vela 当前的 Workflow 是状态机和事件图驱动的可靠执行底座，还不是完整的通用 Graph Runtime。
