# Tool System：工具、Skill 与执行权限的分层设计

## 为什么要做

Agent 的能力来自工具，但风险也来自工具。模型一旦可以调用外部网络、写文件、记忆用户信息、执行代码或调用远端 Agent，就会产生真实副作用。Tool System 的目的，是让模型能扩展能力，但不能绕过权限、审计和运行策略。

Vela 的工具系统不是简单的 function calling 封装，而是把工具定义、发现、审批、执行、幂等、风险和结果包装统一起来。

## 要解决的问题

工具系统要解决几类问题：哪些工具可见，哪些工具可执行，哪些工具需要审批，工具能调用几次，失败如何计数，输出如何限制，工具副作用如何避免重复，外部 MCP 工具如何接入，Skill 如何按需加载。

如果没有这些边界，模型会把所有能力当作普通函数调用，平台就很难保证安全和可控。

## 设计目标

Vela 的目标是让工具成为可治理资源。工具必须有名称、描述、参数 schema、风险等级、审批要求、超时、调用次数和 sandbox 要求。执行时不仅检查模型是否知道这个工具，还检查当前 Turn 是否允许调用。

Skill 的目标则不同。Skill 不是工具执行本身，而是给 Agent 提供“如何使用某类能力”的操作知识，通过 progressive disclosure 降低上下文成本。

## 核心思想

Tool 负责行动，Skill 负责方法。Tool 是模型可以调用的能力边界，Skill 是模型在需要时加载的任务手册。MCP 负责把外部工具生态接入进来，Registry 负责把所有工具统一成执行策略。

这种分层很重要。否则 Skill 会变成 prompt 堆积，Tool 会变成无治理函数，MCP 会变成绕过平台策略的后门。

## 架构设计

Vela 的工具体系可以拆成五层：

- Tool Definition：声明能力、参数、风险、超时、审批和调用限制。
- Tool Registry：集中注册、筛选、执行、并行调用、失败处理和输出截断。
- Tool Policy：根据风险等级、用户确认和稳定 policy key 控制副作用。
- MCP Provider：把数据库、Nacos 或其他来源的外部 MCP 工具转成统一工具。
- Skill Registry：扫描静态、平台和 Nacos Skill，按需加载说明与资产。

## 为什么这样设计

抽象 Tool 是因为模型调用能力必须标准化。无论是内置时间工具、代码执行、记忆写入、MCP 远端工具，还是 A2A handoff，都应该经过同一套 allowlist、审批、风险和审计机制。

Skill 存在是因为很多任务不是一个函数能解决的。比如文档、表格、PDF、代码解释器使用，需要先告诉模型正确流程、约束和产物规范。把这些经验全部塞进系统 prompt 会浪费上下文，也难以更新，所以 Vela 选择按需加载。

## 项目体现

源码体现包括：

- `backend/engine/tools/protocol.py` 体现工具定义、上下文和 Turn 内共享状态。
- `backend/engine/tools/registry.py` 体现注册、allowlist、审批、调用上限、并行执行、输出截断和 step journal。
- `backend/shared/tool_policy.py` 体现工具风险等级与稳定 policy key。
- `backend/engine/tools/mcp_provider.py`、`mcp_loader.py`、`mcp_tool.py` 体现 MCP 工具发现、包装和风险控制。
- `backend/engine/skills/registry.py`、`platform_sync.py`、`backend/biz/services/platform_skill_service.py` 体现 Skill 的静态、平台和 Nacos 来源。
- `backend/engine/tools/builtins/load_skill.py` 体现 progressive disclosure。
- `backend/engine/tools/builtins/code_execution.py` 体现代码执行工具必须进入沙箱，且文档类任务要求先加载对应 Skill。

## Trade-off

严格工具治理会增加模型调用摩擦。例如高风险工具需要审批，代码执行可能因为未加载 Skill 被拒绝，MCP 工具需要域名限制和错误包装。这些都会降低“模型一把梭”的自由度。

但这是生产系统必须付出的代价。工具越强，越不能只相信模型自律。

## 优点

Vela 的工具系统优点是边界明确。模型看见工具不代表一定能执行，执行还要经过 allowlist、审批、调用次数、风险和取消信号。工具结果也被限制大小并作为不可信输出回灌。

Skill 的设计让复杂任务经验可以独立演进。平台可以上传 Skill 包，Engine 同步后按需加载，不需要频繁改主 prompt。

## 缺点

工具系统复杂度较高，新增工具需要考虑 schema、风险、审批、幂等、输出大小、取消、审计和前端展示。对开发者来说门槛高于普通 function calling。

Skill 也需要治理。如果 Skill 来源、版本、资产和触发规则没有管好，它会变成另一种 prompt supply-chain 风险。

## 可以如何优化

可以增加工具市场和能力评分，让模型不仅知道有哪些工具，也知道哪些工具更适合当前任务。审批策略可以更细，例如按用户、项目、环境、工具参数、调用目标域名动态决策。

Skill 方面可以增加版本锁定、签名校验、依赖声明、自动测试和回滚。MCP 工具可以增加供应链扫描、schema 兼容检测和运行时隔离等级。

## 工程经验

Tool System 的关键不是“让模型会调用函数”，而是“让模型不能越权调用函数”。模型输出工具名只是意图，真正的执行权应该始终在平台。

Skill 的工程价值也不只是减少 prompt，而是把团队经验产品化。好的 Skill 是可版本化、可审计、可复用的任务操作规程。

## 踩坑总结

不要只在模型可见工具列表里做权限控制。Vela 在执行端再次检查 allowlist，这是正确的，因为模型输出和客户端输入都不能被信任。

不要让代码执行工具在本机直接运行。源码中明确没有 sandbox provider 时返回不可用，而不是降级到本地执行。

## 值得分享的观点

在 Agent 平台里，Tool 是新的 API 面，Skill 是新的运行手册。前者决定 Agent 能做什么，后者决定 Agent 怎样正确地做。

## 一句话总结

Vela 的 Tool System 用 Registry、Policy、MCP 和 Skill，把模型能力扩展成可审批、可限制、可审计的工程资源。
