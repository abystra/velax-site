# Protocol Layer：以 AG-UI 为主协议的可扩展协议层

## 为什么要做

Agent 平台不能把内部状态直接暴露给前端或外部系统。模型流、工具调用、推理文本、状态变化、人工中断、产物、远端 Agent 子运行，都需要一个统一协议承载。Protocol Layer 的价值，是让执行系统、前端 UI 和外部生态解耦。

Vela 选择以 AG-UI 作为前端运行协议，同时接入 MCP、Skill 和 A2A 作为能力协议。

## 要解决的问题

协议层要解决的是多方协作问题：Engine 要输出事件，Biz 要持久化并转发，前端要恢复和渲染，工具要通过 MCP 接入，远端 Agent 要通过 A2A handoff 对接，Skill 要作为可加载任务知识存在。

如果协议写死在业务代码里，每接一种前端或外部工具都要改主流程，系统会很快不可维护。

## 设计目标

Vela 的目标是统一 wire contract，同时保留扩展空间。标准 AG-UI 事件承载通用运行语义，Vela 自有语义通过 CustomEvent 和 normalized durable metadata 表达，而不是往标准事件里随意加字段。

MCP、Skill、A2A 也通过 provider 和 registry 接入，避免 Engine 直接依赖某个具体发现机制。

## 核心思想

协议层的核心思想是“标准事件 + 自有扩展 + provider 解耦”。标准协议保证生态兼容，自有扩展保证业务表达，provider 解耦保证协议来源可以替换。

这也是为什么 Vela 不把协议写死。AG-UI、MCP、A2A 和 Skill 的生命周期、生态成熟度和运行方式都不同，硬编码会让主循环难以演进。

## 架构设计

Vela 的协议层可以分为四类：

- AG-UI：前端运行事件协议，承载文本、推理、工具、状态、错误、终态和快照。
- MCP：外部工具协议，把工具发现和调用抽象出来。
- Skill：任务操作知识协议，让 Agent 按需加载能力说明和资产。
- A2A：远端 Agent handoff 协议，把其他 Agent 暴露成可治理工具。

这些协议不直接互相替代，而是分别服务于 UI、工具、知识和 Agent 间协作。

## 为什么这样设计

统一协议层可以避免三类耦合。第一，前端不需要理解 Engine 内部对象，只消费 AG-UI 事件。第二，Engine 不需要知道 MCP 工具来自数据库还是 Nacos，只依赖 provider。第三，远端 Agent 不直接接管本地会话，而是通过 handoff 工具进入受控执行。

协议不写死还带来部署灵活性。平台可以先用数据库 provider，后续切到 Nacos provider；Skill 可以来自本地、平台缓存或 Nacos；A2A 可以先用工具化 handoff，未来再扩展完整子运行协议。

## 项目体现

源码体现包括：

- `backend/engine/loop/stream_writer.py` 使用 AG-UI 官方事件，并通过 `vela.*` custom events 表达产物、状态、retrieved context 和 subrun。
- `backend/engine/eventbus` 将同一事件分发到 Redis Stream 和 durable event sink。
- `backend/biz/api/v1/streaming.py` 通过 SSE 转发 AG-UI，并在重连时从 durable events 重建 snapshot。
- `backend/shared/agui/extension.py` 明确 Vela 自有语义不扩展标准事件字段。
- `backend/shared/agui/capabilities.py` 声明 streaming、tool、snapshot、reasoning、multimodal、sandbox、human-in-loop 等能力。
- `backend/engine/tools/mcp_*` 体现 MCP 工具适配。
- `backend/engine/skills` 和平台 Skill 服务体现 Skill 协议。
- `backend/engine/agents` 与 `backend/engine/tools/handoff.py` 体现 A2A handoff。

## Trade-off

协议层越清晰，事件转换和投影成本越高。AG-UI 事件、durable events、Redis Stream、前端 snapshot 之间需要保持语义一致，否则会出现恢复和实时展示不一致。

另一个取舍是自有扩展不能过度。CustomEvent 可以快速承载业务语义，但如果缺少规范，前端和后端会重新产生隐式耦合。

## 优点

Vela 的协议层优势是清楚地区分标准和扩展。标准 AG-UI 负责通用运行事件，Vela 扩展负责项目特有语义。这样既能兼容外部协议，又能满足自身产品需求。

MCP、Skill、A2A 都没有被直接写进主业务流程，而是通过 provider、registry 和工具包装进入系统，给未来替换和扩展留下空间。

## 缺点

当前 A2A 仍主要以 handoff 工具形式存在，远端 Agent 的完整流式子运行、跨 Agent 状态治理和多 Agent 可视化还没有完全闭环。

协议层也增加了调试难度。一个 UI 展示问题可能来自 Engine 事件、EventBus、durable projection、Redis Stream 或前端解析，排查链路较长。

## 可以如何优化

可以为 Vela CustomEvent 建立正式 schema 和版本策略，减少前后端隐式约定。A2A 方向可以增强远端流式事件透传、父子运行树、取消传播、输入请求和权限范围校验。

MCP 和 Skill 可以加入签名、来源可信度、版本锁定和供应链审计。AG-UI projection 可以增加一致性测试，确保历史恢复和实时流结果一致。

## 工程经验

协议层最重要的是不要让内部实现泄漏成外部契约。Vela 把内部执行转成 AG-UI，再把 Vela 自有语义放进 custom namespace，是比较稳妥的做法。

同时，协议层要允许失败。Redis Stream 是实时缓冲，durable events 才是事实源，这个分工能提升恢复能力。

## 踩坑总结

不要把 AG-UI 当成数据库事实源。它是运行事件协议，真正的恢复还依赖 durable events。

不要把 MCP 或 A2A 工具当成可信本地函数。它们是外部能力，必须经过风险、审批、域名和输出包装。

## 值得分享的观点

Agent 平台的协议层不只是传输格式，而是扩展性边界。谁能被替换、谁能被治理、谁能被前端恢复，最终都由协议设计决定。

## 一句话总结

Vela 用 AG-UI 统一运行事件，用 MCP、Skill、A2A 扩展能力，并通过 provider 和 custom namespace 避免协议硬编码。
