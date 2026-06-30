# 未来演进：从可运行平台走向可治理 Agent 操作系统

## 为什么要做

Vela 已经具备 Agent 平台的核心骨架：Turn、事件、Agent Loop、工具、Skill、沙箱、AG-UI、Nacos provider、知识和记忆。但从源码看，它仍处在从“能运行”向“可治理、可扩展、可运营”演进的阶段。

未来演进的意义，是把现有工程底座变成长期可维护的平台能力。

## 要解决的问题

接下来要解决的问题不只是增加功能，而是增强确定性。多 Agent 如何协作，工具供应链如何治理，知识质量如何评估，沙箱资源如何运营，Nacos 配置如何热更新，Graph Workflow 是否需要产品化，内部 API 如何加固，这些都决定项目能否承载更复杂场景。

## 设计目标

未来一年比较合理的目标，是在不破坏当前边界的前提下增强五件事：多 Agent 编排、知识质量、工具治理、沙箱运营、平台可观测性。

这些都应该建立在当前 durable events、Turn 状态机、provider 抽象和工具策略之上，而不是另起一套运行体系。

## 核心思想

未来演进的核心思想是：把当前隐含的工程能力产品化。比如现在有 handoff 工具，未来可以产品化成多 Agent 子运行树；现在有状态机和事件日志，未来可以产品化成 Graph Runtime；现在有工具风险策略，未来可以产品化成工具治理控制台。

这不是推翻重写，而是沿着已有边界继续抽象。

## 架构设计

可以按六条线演进：

- Multi Agent：从 handoff 工具走向 Supervisor、子任务、子运行流、取消传播和权限传递。
- Workflow：在 Turn/Event 之上引入轻量 Graph Runtime，支持节点、条件、重试、人工输入和子图。
- Knowledge：加入 hybrid retrieval、rerank、评测、引用、权限过滤和知识生命周期。
- Tool Governance：增强审批、供应链安全、MCP 签名、域名策略、配额和审计。
- Sandbox Ops：增加 warm pool、资源配额、网络 egress、生命周期 GC、provider 健康检查。
- Platform Ops：完善 Nacos 热更新边界、服务健康、内部 API 安全、可观测性和 Admin 控制台。

## 为什么这样设计

这些方向都来自当前源码的自然延伸。现有系统已经有 handoff、状态机、事件、工具策略、沙箱 provider、Nacos provider 和后台任务，只是还没有完全产品化。

如果直接堆新功能，会让复杂度失控。更好的方式是把已有抽象补完整：先让每个边界可观测、可配置、可测试，再增加更复杂能力。

## 项目体现

源码中已经成熟的基础包括：

- Turn 状态机、租约、reaper 和 durable events。
- Agent Loop、Context Builder、Compact、Stream Writer。
- Tool Registry、Tool Policy、MCP、Skill、code execution。
- E2B/OpenSandbox provider 和 sandbox contract。
- AG-UI 标准事件与 Vela custom events。
- Nacos 配置、注册、MCP、Skill、A2A provider 接入点。
- 知识索引、embedding、项目文件检索和 memory policy。

源码中尚未完整体现的方向包括：通用 Graph Runtime、完整多 Agent Supervisor、独立 rerank、完整 Nacos 热更新治理、Docker/Firecracker provider、统一工具市场和生产级沙箱运营。

## Trade-off

未来演进最大的取舍是抽象时机。如果过早引入 Graph、多 Agent Supervisor 和复杂治理，会拖慢当前产品迭代；如果太晚引入，现有 Loop 和工具系统会逐渐承担过多职责。

另一个取舍是开放生态与安全治理。MCP、Skill、A2A 越开放，供应链、权限和审计压力越大。

## 优点

Vela 的优势是已有边界相对清晰，未来演进不需要从零开始。它已经把 Agent 平台中最重要的分界线画出来了：Biz/Engine、Event/Stream、Tool/Skill、Provider/Implementation、Sandbox/Host。

这让重构可以是渐进式，而不是大爆炸式。

## 缺点

当前项目复杂度已经较高，如果缺少测试、观测和文档同步，后续任何大功能都会增加维护风险。尤其是多 Agent、Graph 和 Sandbox 运营，都会把系统推向更复杂的分布式状态管理。

另外，部分能力依赖外部 `vela-*` 包和第三方服务，版本兼容与故障降级需要持续关注。

## 可以如何优化

短期可以优先做可靠性增强：内部 API 鉴权、事件一致性测试、Turn 终态测试、工具幂等测试、沙箱健康检查、Worker 延迟监控。

中期可以做能力产品化：工具治理台、Skill 版本管理、Nacos provider 状态、知识评测、A2A 子运行可视化。

长期可以引入 Graph Runtime 和多 Agent Supervisor，但应复用现有 Turn、Event、Tool 和 Protocol，不应绕开已有事实源。

## 工程经验

Agent 平台的未来演进不能只看模型能力。真正会限制系统规模的是状态、权限、成本、隔离、协议和可观测性。

Vela 已经证明了一个方向：先把不确定执行纳入工程边界，再逐步扩大自主能力。

## 踩坑总结

不要把“未来可以做”写成“现在已经有”。比如完整多 Agent、通用 Graph、rerank、Docker provider 和 Nacos 全量热更新，目前源码没有完整闭环。

不要为了抽象而抽象。Graph 和 Supervisor 只有在任务复杂度足够高、现有 Loop 难以维护时才值得引入。

## 值得分享的观点

Agent 平台的下一阶段不是更会聊天，而是更会治理：会限制工具，会隔离代码，会恢复状态，会审计副作用，会管理外部能力，会把失败变成可处理事件。

## 一句话总结

Vela 未来最有价值的演进方向，是在现有可靠执行底座上，把多 Agent、Graph、知识、工具、沙箱和平台治理逐步产品化。
