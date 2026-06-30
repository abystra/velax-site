# AI Agent Engineering Architecture

## Background

AI Agent 在工程侧的复杂度增长路径与常规业务系统存在显著差异。Agent 的开发范式经历了以下阶段：

1. 单 Agent 原型阶段。通过 Prompt + Tool Call 的简单组合即可在 demo 环境完成目标任务。
2. Agent 数量增长阶段。随着场景扩展，每个 Agent 独立维护自身的工具接入、上下文管理、错误恢复和观测逻辑。
3. 工程化需求涌现阶段。Agent 数量突破临界点后，重复建设、能力无法复用、执行不可观测、安全边界不统一等问题从工程层面暴露，无法通过提升模型能力解决。

上述演进路径与行业主流产品的工程方向一致。OpenAI 从 Chat 到 Projects、Canvas、Deep Research、Connectors、Enterprise 的产品演进，Anthropic 从 Claude 到 Projects、Artifacts、MCP、Skills 的体系化建设，均指向同一结论：Agent 工程化的核心挑战不在模型能力，而在能力组织、执行治理和资产复用。

本文档描述 AI Agent Engineering Architecture 的整体设计，涵盖 Runtime、Protocol、Knowledge、Context Engineering、Engineering/Iteration、Evaluation、Gateway、Governance/Security 八个技术层的职责边界、设计决策与演进方向。

## Problem Statement

当前 Agent 系统在工程层面面临以下核心问题：

**P1 — 执行不可控**。Agent 在模型自主决策下的多轮执行缺乏统一的迭代上限、失败收敛、重复检测和强制收尾机制。单个 Agent 的异常行为（无限循环、资源耗尽、静默偏离）缺乏工程层面的兜底。

**P2 — 连接不可复用**。Agent 与工具、数据源、其他 Agent 之间采用点对点集成，连接数量随 Agent 增长呈 N×M 复杂度。每次新增 Agent 需重新实现工具接入逻辑，已有能力无法跨 Agent 共享。

**P3 — 知识不可治理**。私有知识分散在多个 Agent 的检索逻辑中，缺乏统一的 Chunk 策略、重排机制、溯源引用和质量评估。知识的更新、过期、版本管理无统一生命周期。

**P4 — 上下文不可管理**。Agent 的上下文组织依赖开发者手工拼接 Prompt，缺乏分段缓存、按需注入、超长压缩和状态外置的工程化能力。每次会话从初始状态开始，无法实现跨会话记忆和项目级上下文复用。

**P5 — 内容不可迭代**。AI 产出局限于单次生成，缺乏增量修改、版本追溯、协作状态管理和异常回滚的能力。

**P6 — 质量不可度量**。Agent 行为评估依赖人工主观判断，没有标准问题集、轨迹级评测、回归测试和发布门禁。Prompt 调整的效果缺乏量化反馈。

**P7 — 入口不可管控**。多模型、多工具、多 Agent 的接入点分散，鉴权、限流、路由、审计各自独立实现，缺乏统一的策略层。

**P8 — 安全不可保障**。Agent 执行模型生成代码的环境缺乏沙箱隔离、出口管控和人工确认机制，无法满足企业级安全合规要求。

## Design Goals

| Goal | 可验证标准 |
|------|-----------|
| G1 — 执行可控 | 每个 Agent 执行实例具备明确的迭代上限、失败预算、重复检测和强制收尾，异常行为可在 1 个迭代周期内被 Runtime 主动收敛 |
| G2 — 连接标准化 | 工具接入、Agent 间通信、前端展示均通过标准协议完成，新工具接入无需修改 Agent 代码 |
| G3 — 知识可溯源 | 所有基于外部知识的回答附带来源引用，检索质量通过召回率和幻觉率量化 |
| G4 — 上下文可管理 | 上下文支持分段缓存、按需注入、超长压缩，会话状态可重建，支持跨会话记忆 |
| G5 — 内容可迭代 | 支持增量修改、版本快照、修改历史追溯和异常回滚 |
| G6 — 质量可度量 | 具备标准评测集、轨迹级评分、回归测试和发布门禁，Prompt 变更效果可量化对比 |
| G7 — 入口可管控 | 所有模型调用、工具调用、Agent 调用经过统一网关，具备鉴权、限流、路由、审计能力 |
| G8 — 安全边界明确 | 不可信代码执行具备内核级隔离和出口管控，高风险操作经过人工确认 |

## Non-Goals

- 不定义具体业务 Agent 的实现逻辑。本文档描述工程化能力层的架构，业务 Agent 作为能力消费者按需组合各层能力。
- 不规定模型选型策略。模型层作为可替换组件，通过 Adapter 接入 Runtime，本文档不涉及模型版本管理。
- 不定义前端 UI 规范。AG-UI 定义了 Agent 到前端的标准事件协议，前端渲染层的具体实现在本文档范围之外。
- 不提供知识内容的生产规范。Knowledge 层定义知识的存储格式、检索链路和治理机制，具体知识内容由业务侧维护。
- 不涉及基础设施层的具体选型（消息队列、对象存储、容器编排）。各层的能力描述与具体基础设施解耦。

## Overall Architecture

系统采用分层架构，从下至上分为八层。每层向上层暴露标准化接口，向下层消费能力。

```
Layer 8  Governance / Security    — 沙箱、出口管控、权限、审计、人工确认
Layer 7  Gateway                  — 统一入口、鉴权、限流、路由、协议转换
Layer 6  Evaluation               — 评测流水线、轨迹评分、回归测试、发布门禁
Layer 5  Engineering / Iteration  — 增量修改、版本追溯、协作状态、异常回滚
Layer 4  Context Engineering      — 分段提示、上下文缓存、状态外置、按需注入
Layer 3  Knowledge                — 检索、重排、溯源、知识组织、生命周期管理
Layer 2  Protocol                 — MCP (南向)、A2A (东西向)、AG-UI (北向)
Layer 1  Runtime                  — Agent Loop、Scheduler、Executor、State Machine
```

分层原则：

- Layer 1-2 为执行基础。确保 Agent 能够受控运行并标准化连接外部能力。
- Layer 3-5 为工程化增强。使 Agent 具备知识管理、上下文控制和内容迭代的工程化能力。
- Layer 6-8 为治理与安全。确保 Agent 可度量、可管控、可审计、可进入生产环境。

层间依赖方向为自下而上：上层可以依赖下层，下层不感知上层。每层可独立演进，通过接口版本管理控制变更影响范围。

---

## Layer 1 — Runtime

### 1.1 职责边界

Runtime 是 Agent 的执行引擎，负责将任务目标转化为受控的多轮执行过程。核心职责：

- 维护 Agent Loop 的生命周期
- 管理 Execution Context 的创建、传播和清理
- 调度 Tool Invocation 并处理执行结果
- 执行状态机的状态转换
- 在预定义边界条件触发时主动收敛执行

Runtime 不负责：
- 任务目标的业务语义理解（由上层 Planner 处理）
- 工具的具体实现（工具通过 Protocol 层接入）
- 知识内容的检索逻辑（由 Knowledge 层提供检索能力原子）

### 1.2 执行模型

Runtime 将 Agent 的一次执行抽象为以下状态机：

```
INIT → PLANNING → EXECUTING → OBSERVING → (loop back to PLANNING or EXECUTING)
                                                    ↓
                                              TERMINATING → COMPLETED
                                                    ↓
                                               FAILED / TIMEOUT
```

状态转换由 Scheduler 驱动，每个转换点检查以下控制条件：

| 控制条件 | 触发阈值 | 收敛行为 |
|---------|---------|---------|
| Iteration Cap | 达到最大轮次 N | 强制进入 TERMINATING，输出当前阶段结果 |
| Failure Budget | 连续失败次数达到 M | 终止执行，标记 FAILED 并记录 Failure Trace |
| Duplicate Detection | 连续 K 次调用同一 Tool 且参数哈希一致 | 交还控制权，请求人工干预或进入 TERMINATING |
| Timeout | 全局执行时间超过 T | 强制终止，触发 Checkpoint 持久化 |

### 1.3 Event Sourcing

Runtime 将每一次执行过程中的所有事件持久化为不可变事件流：

```
Event Schema:
{
  event_id: UUID,
  execution_id: UUID,
  event_type: USER_INPUT | MODEL_OUTPUT | TOOL_CALL | TOOL_RESULT |
              CONTEXT_SNAPSHOT | STATE_TRANSITION | ERROR,
  timestamp: ISO8601,
  payload: { ... },
  parent_event_id: UUID | null
}
```

事件流的设计目标：

- **可重建**：任意时刻的 Execution Context 可通过事件流回放重建。
- **可审计**：每一次工具调用、模型推理和状态转换均有完整记录。
- **可恢复**：Runtime 进程故障后，新 Runtime 实例可从 Checkpoint + 增量事件恢复执行。
- **可评测**：事件流作为 Evaluation 层轨迹级评级的直接数据源。

### 1.4 状态外置

Runtime 进程本身不持有执行状态。状态通过以下方式外置：

- Context Snapshot：定期将 Execution Context 序列化存储。
- Checkpoint：在关键状态转换点（工具调用前后、TERMINATING 前）强制写入 Checkpoint。
- 事件流：作为 Checkpoint 之间的增量日志。

该设计使 Runtime 进程变为无状态计算单元，支持：
- 进程故障后从最近 Checkpoint 恢复
- Runtime 实例的横向扩展
- 长任务的跨进程续跑

### 1.5 Durable Execution

当前 Runtime 已完成受控执行闭环和事件溯源。后续方向为实现 Durable Execution：任务在失败、重启、断线后从断点幂等续跑。

核心挑战：

- Tool Invocation 的幂等性保证：重试时需判断 Tool 是否已执行、执行结果是否可复用。
- 外部副作用处理：已发送的 HTTP 请求、已写入的数据库记录需要回滚或补偿。
- Checkpoint 粒度权衡：Checkpoint 过于频繁影响吞吐，过于稀疏增加恢复成本。

### 1.6 扩展点

- Planner 可插拔：不同 Agent 可配置不同的 Planning 策略（ReAct、Tree-of-Thought、自定义）。
- Tool Resolver 可扩展：支持通过 Protocol 层动态注册新的工具解析器。
- State Machine Hook：在状态转换点提供 Hook，支持注入自定义行为（审计日志、自定义收敛策略）。

---

## Layer 2 — Protocol

### 2.1 职责边界

Protocol 层在架构中承担外部能力协议层，解决 Agent 与外部系统之间的连接标准化问题。

当前连接场景的复杂度来源：Agent 数量增长时，每个 Agent 需要对接工具、数据源、其他 Agent 和前端。如果采用点对点集成，连接总数为 O(N×M)，其中 N 为 Agent 数量，M 为外部系统数量。

Protocol 层提供三套标准化协议：

| 协议 | 方向 | 标准化范围 |
|------|------|-----------|
| MCP | Southbound | Agent ↔ Tool / Data Source / Workflow |
| A2A | East-West | Agent ↔ Agent (Discovery, Invocation, Delegation) |
| AG-UI | Northbound | Agent ↔ Frontend (Streaming Events) |

### 2.2 MCP — 南向能力协议

MCP 在架构中定位为能力接入层。核心抽象是 **Tool Contract**：

```
Tool Contract:
  name             — 全局唯一的工具标识
  description      — 工具的语义描述（供模型理解）
  input_schema     — JSON Schema 定义的输入参数约束
  output_schema    — JSON Schema 定义的输出格式
  metadata         — { owner, version, ttl, rate_limit, auth_required, idempotent }
```

Tool Contract 使 Runtime 能够以一致方式完成能力发现、参数校验、权限检查和执行调度，无需感知工具的异构实现。

**能力注册流程**：

```
Tool Provider → Register Tool Contract → Capability Registry → Runtime Discovery
                                                    ↓
                                          Gateway 鉴权 / 路由 / 审计
```

### 2.3 能力与知识的工程判别

架构中将"动作能力"与"方法论知识"解耦为不同抽象：

| 维度 | MCP Tool (能力) | Skill (知识) |
|------|----------------|-------------|
| 抽象本质 | 确定性的请求-响应动作 | 需要模型判断的方法论指引 |
| 契约形态 | 稳定的输入输出 Schema | 模板 + 流程描述 + 约束条件 |
| 是否需要模型推理 | 否 | 是 |
| 复用范围 | 跨 Agent 共享，作为能力原子 | 跨 Agent 可移植，作为知识资产 |

**判别规则**：需要模型按指引自行决策执行路径 → Skill；仅需模型决定调用时机和参数 → MCP Tool。

确定性业务逻辑不抽象为 MCP 或 Skill，直接留在业务代码中通过标准服务接口暴露。

### 2.4 能力原子与编排策略的切割

MCP Tool 的抽取粒度是最关键的工程判断。切割线定义：

- **编排策略层**（留在 Agent）：易变、业务专属、需要模型判断——由 Agent 内部的 Planner 持有。
- **能力原子层**（抽离为 MCP）：稳定契约、跨 Agent 复用——通过 Tool Contract 暴露。

两个已被验证的反模式：

**God-MCP**：将整个系统的所有接口打包为单一 MCP Server，暴露数十到上百个 Tool。后果是上下文窗口被 Tool Definition 占满，模型在 Tool 选择上产生混淆，且无法按需路由。

**过度 Tool 化**：将确定性的、单一业务专属的内部函数调用也包装为 MCP Tool。后果是引入不必要的网络延迟和序列化开销，增加故障面，且实际不会被复用。

### 2.5 A2A — Agent 间协作协议

A2A 协议定义 Agent 间通信的标准范式：

- Agent Discovery：Agent 通过 Registry 注册自身的 Capability Manifest，其他 Agent 可查询和发现。
- Task Delegation：Agent A 可将子任务委派给 Agent B，附带上下文和约束条件。
- Lifecycle Propagation：父任务取消时，子任务应收到取消信号并终止。

当前阶段已完成 Agent 注册发现。后续方向为可执行协作：任务委派、子任务生命周期管理和取消传播。

### 2.6 AG-UI — 北向展示协议

AG-UI 定义 Agent 到前端的标准事件流。前端仅消费一套标准化事件类型：

```
Event Types:
  TEXT_DELTA            — 文本增量输出
  TOOL_CALL_START / END — 工具调用生命周期
  STATE_SNAPSHOT        — 执行状态快照
  CONTEXT_UPDATE        — 上下文变化通知
  ERROR                 — 异常事件（含错误码和恢复建议）
```

### 2.7 AG-UI 统一 A2A 输出的架构决策

**Decision**：Agent A 调用 Agent B 时，B 的回传也通过 AG-UI 事件范式，而非使用独立的 A2A 响应格式。

**Context**：A2A 调用场景下，子 Agent 的执行过程（思考链、工具调用、中间结果）对父 Agent 和前端均具有观测价值。如果 A2A 使用独立的响应格式，前端需要维护两套渲染逻辑。

**Alternatives**：
1. A2A 使用独立二进制协议，前端通过 Agent 适配层分别渲染。
2. A2A 回传复用 AG-UI 事件流。

**Rationale**：选择方案 2。复用 AG-UI 事件流使渲染管线可统一，子 Agent 的执行过程可直接冒泡到用户界面，Agent 组合时无需额外的渲染适配层。

**Consequences**：需要在 A2A 层增加一层 AG-UI ↔ A2A 的映射适配。该代价在当前评估中可接受——统一输出范式带来的组合性收益超过适配层的维护成本。

---

## Layer 3 — Knowledge

### 3.1 职责边界

Knowledge 层负责外部知识的检索、组织、溯源和生命周期管理。核心职责：

- 提供统一的检索接口（向量检索、关键词检索、混合检索）
- 管理知识的 Chunk 策略和重排（Reranker）流水线
- 维护知识来源的引用完整性
- 管理知识的更新、过期和版本
- 提供检索质量的量化指标

Knowledge 层不负责：
- 知识内容的生产（由业务侧维护）
- 模型的推理和生成（由 Runtime 调用模型完成）
- 检索结果在 Prompt 中的具体编排（由 Context Engineering 层处理）

### 3.2 检索工程谱系

检索能力的选型需按问题复杂度分级，而非将 Agentic RAG 作为默认方案：

| 检索类型 | 适用场景 | 技术特征 | 代价 |
|---------|---------|---------|------|
| Classic RAG | 单跳事实查询 | 向量检索 + 重排 | 低 |
| Graph RAG | 多跳关系查询 | 实体关系遍历 + 图检索 | 中 |
| Agentic RAG | 多步调查分析 | 复用 Runtime 的多轮执行能力 | 高 |

选型原则：架构由问题形状决定。纯事实查询使用 Agentic RAG 会引入不必要的多轮推理延迟和 token 消耗，且增加不稳定因素。

### 3.3 检索管线的工程约束

基于工程实践，以下约束已被验证为生产级 RAG 的必要条件：

- Chunk 策略直接影响召回质量。Chunk 大小、重叠窗口、语义边界识别需按文档类型分别配置，不存在通用最优值。
- Reranker 是标配而非可选项。向量检索的语义相似度排序不足以满足精确匹配需求，重排阶段需结合关键词匹配和语义相关性联合打分。
- 数据工程是生产级 RAG 的核心瓶颈。文档清洗、结构化、元数据维护和更新管线的工程投入远超模型选型的复杂度。
- 检索不是推理。纯向量检索无法处理多跳关系问题，Graph RAG 和 Agentic RAG 分别对应不同的关系复杂度层级。

### 3.4 Knowledge OS 目标框架

Knowledge 层的长期演进方向是 Knowledge OS——知识从"可检索"走向"可组织、可治理、可复利"。目标框架包含八个维度：

| 维度 | 职责 |
|------|------|
| Knowledge Engineering | 抽取 / 清洗 / 结构化 / 事实化 |
| Knowledge Organization | 实体-关系网络（Graph），可遍历、可推理 |
| Knowledge Lifecycle | 更新策略、过期标记、版本管理 |
| Knowledge Governance | 溯源链完整性、引用准确性、质量评分、权限模型、可信度等级 |
| Enterprise Memory | 会话级 / 项目级 / 组织级三层记忆，支持复利增长 |
| Compiled Knowledge | 高频稳定知识预编译为可加载的静态资产，降低运行时检索消耗 |
| Context Engineering | 按需注入检索结果，而非全量填充 |
| Open Knowledge Format | MD + frontmatter 格式，厂商中立，避免绑定特定知识库产品 |

### 3.5 知识接入 Runtime 的集成原则

1. 检索能力通过 MCP Tool Contract 暴露为能力原子，由 Runtime 统一调度。
2. 检索结果通过 Context Engineering 层以"带出处标注"的方式注入上下文。
3. 复杂检索场景复用 Runtime 的执行闭环（多轮检索、交叉验证），不另建检索引擎。
4. 检索质量（召回率、引用完整性、幻觉率）纳入 Evaluation 层的评测指标体系。

---

## Layer 4 — Context Engineering

### 4.1 职责边界

Context Engineering 层负责管理每次模型推理的上下文配置。核心职责是将上下文从开发者手工拼接 Prompt 字符串提升为可分段、可缓存、可重建、可按需注入的工程化配置。

该层不负责：
- 上下文的语义内容生成（由上层业务逻辑决定）
- 模型的推理执行（由 Runtime 完成）

### 4.2 分段上下文模型

上下文被分解为以下 Segment，每段具有独立的生命周期和缓存策略：

| Segment | 内容 | 变更频率 | 缓存策略 |
|---------|------|---------|---------|
| Static Segment | 系统级指令、Tool Definitions | 版本级 | 持久缓存，版本变更时失效 |
| Project Segment | 项目背景、领域知识、约束条件 | 会话级 | 按项目 ID 缓存 |
| Session Segment | 当前会话历史、运行时提醒 | 轮次级 | 每次迭代增量更新 |
| Retrieval Segment | 按需注入的检索结果和记忆片段 | 查询级 | 不缓存，按需获取并注入 |

### 4.3 上下文压缩

超长会话的上下文管理采用边界压缩策略：

- 当上下文长度超过窗口阈值的 P% 时触发压缩。
- 压缩算法对历史消息进行摘要化，保留关键事实和决策节点，丢弃冗余的中间推理过程。
- 压缩不篡改原始历史——原始事件流完整保存，压缩仅影响当前注入的上下文快照。
- 被压缩的信息仍可通过检索手段按需召回。

### 4.4 状态外置与可重建

上下文状态不绑定 Runtime 进程：

- 每次推理后的 Context Snapshot 序列化到外部存储。
- 上下文的完整状态可通过事件流回放重建。
- Runtime 进程无状态，支持故障恢复和水平扩展。
- 模型切换时，上下文可无损迁移（模型 Adapter 负责处理不同模型的上下文格式差异）。

---

## Layer 5 — Engineering / Iteration

### 5.1 职责边界

Engineering / Iteration 层解决 AI 产出的持续修改和版本管理问题。传统 AI 使用模式（单次请求-单次响应）无法满足需要多轮修改和协作的场景。

核心职责：

- 管理内容的增量修改（而非每次全文重生成）
- 维护修改历史的版本快照
- 支持多轮协作中的状态一致性
- 处理修改失败和格式破坏时的回滚与恢复

### 5.2 关键能力

| 能力 | 实现方式 |
|------|---------|
| 增量修改 | 基于 Diff 的内容更新，仅传输和重生成变更部分 |
| 版本追溯 | 每次修改生成快照，关联到执行事件流的 event_id |
| 协作状态管理 | 内容状态绑定到 Execution Context，跨会话保持一致 |
| 异常回滚 | 修改失败时自动回滚到最近的已知良好快照 |
| 多模型适配 | 不同模型在内容修改任务上的格式差异由 Adapter 层弥合 |

---

## Layer 6 — Evaluation

### 6.1 职责边界

Evaluation 层提供 Agent 行为的可度量性。核心职责是建立从 Prompt 调整到行为变化的量化反馈闭环。

该层不负责：
- Agent 的具体执行逻辑
- 模型本身的 benchmark 评测（属于模型选型范畴）

### 6.2 评测流水线设计

```
Test Case Set → Agent Execution → Trace Collection → Multi-Level Scoring → Regression Report
                                                              ↓
                                                     Production Failure → Auto-Convert to Test Case
```

**Test Case Set**：按场景构建的标准问题集，每个 Case 包含输入、期望输出、可接受的偏差范围和评分规则。Case 来源包括手动构建和线上失败自动转回归。

**Trace Collection**：Agent 执行时产生的完整事件流作为评测输入。轨迹级评测不仅评估最终输出，还评估中间步骤（工具选择、推理路径、调用顺序）的正确性。

**Multi-Level Scoring**：
- Machine Scoring：对确定性问题（数值匹配、字段完整性）的自动判分。
- Rule-Based Scoring：基于规则的检查（引用完整性、输出格式、必填字段）。
- Human Sampling：对需要语义判断的 Case 进行人工抽检。

**Regression Report**：每次 Prompt 或配置变更后自动运行评测流水线，生成变更前后对比报告。

**Publishing Gate**：评测结果作为版本发布的前置条件。关键指标（幻觉率、召回率、任务成功率）低于阈值时阻断发布。

### 6.3 评测指标

| 指标 | 定义 | 应用场景 |
|------|------|---------|
| Recall@K | 检索结果中包含正确答案的比例 | 知识检索质量评估 |
| Citation Integrity | 回答中引用与实际来源一致的比例 | 幻觉检测 |
| Hallucination Rate | 声称有依据但实际无法追溯到来源的断言比例 | 可信度评估 |
| Task Success Rate | 按场景定义的端到端任务完成比例 | 业务效果评估 |
| Tool Selection Accuracy | 工具选择和调用顺序的正确率 | Runtime 行为评估 |

---

## Layer 7 — Gateway

### 7.1 职责边界

Gateway 层作为所有 AI 调用的统一入口，负责鉴权、限流、路由、审计和协议转换。

管控范围：Tool Invocation、Agent-to-Agent Call、Model API Call、Knowledge Retrieval Request。

非管控范围：业务数据的处理逻辑、Agent 内部的执行流程。

### 7.2 关键能力

| 能力 | 工程实现 |
|------|---------|
| Protocol Translation | 存量接口通过 Gateway 的协议适配层包装为 MCP Tool Contract，无需改造原有接口 |
| Authentication & Authorization | 统一的 Token / API Key 校验，支持按 Tool、Agent、Model 粒度的权限控制 |
| Rate Limiting | 支持按 User、Agent、Tool 维度的速率控制，包括令牌桶和滑动窗口策略 |
| Smart Routing | 根据任务语义从 Capability Registry 筛选相关 Tool，仅将匹配的 Tool Definition 注入上下文 |
| Audit Logging | 所有经过 Gateway 的调用记录持久化（调用方、目标、时间、参数哈希、结果状态） |
| Circuit Breaking | 模型或 Tool 不可用时自动熔断，返回降级响应而非阻塞等待超时 |

### 7.3 演进方向

当前 Gateway 已具备协议转换、鉴权、限流和路由的基础能力。后续方向为统一策略层：将分散在多个组件中的策略（模型选择策略、Tool 路由策略、限流策略、审计策略）收敛到 Gateway 的 Control Plane 进行统一管理。

---

## Layer 8 — Governance / Security

### 8.1 职责边界

Governance / Security 层提供 Agent 在企业和政企环境中所必需的可控、可信和合规能力。该层由两个子域组成：

**Governance**：
- Capability Registry：MCP Tool、Skill、Agent 的统一注册与发现
- Control Plane：运行时动态启停、配置下发
- Observability：执行可视化、Monitor、Alert
- Audit Trail：操作审计和追溯

**Security**：
- Sandbox Isolation：不可信代码的隔离执行
- Egress Control：出口流量管控
- Human-in-the-Loop：高风险操作的人工确认
- Permission Boundary：数据访问和工具调用的权限边界

### 8.2 运行环境复杂度分析

AI Agent 从本地开发环境进入企业生产环境时，复杂度增长来源不是模型本身，而是运行环境：

| 维度 | 本地环境 | 企业生产环境 |
|------|---------|------------|
| 租户模型 | 单用户 | 多租户，权限隔离 |
| 数据边界 | 用户自有数据 | 企业数据分级、合规要求 |
| 网络边界 | 无限制 | 内外网隔离、出网管控 |
| 运行模式 | 单次执行 | 持续运行、接入业务系统 |
| 审计要求 | 无 | 全链路审计、操作追溯 |

### 8.3 沙箱隔离模型

Skill 的执行环境需要沙箱隔离，因为 Skill 执行的代码由模型生成，属于不可信输入。

隔离方案按强度递增：

1. Container (Docker/OCI)：基础进程级隔离。存在容器逃逸风险，适用于低敏感任务。
2. Seccomp / User-space Interception：系统调用级过滤。在容器基础上增加 syscall 白名单。
3. MicroVM (Firecracker)：独立内核的轻量虚拟机。每个 Skill 执行实例拥有独立内核，隔离级别接近物理机。推荐用于生产环境。
4. Wasm Runtime：语言级沙箱。适用于计算密集型、无需系统调用的场景。

沙箱的三道可配置边界：

- Kernel Isolation：决定 Skill 代码是否可访问宿主机内核接口。
- Filesystem Isolation：决定 Skill 代码可读写的文件系统范围。
- Egress Control：决定 Skill 代码可访问的外部网络地址范围。

三道边界中，Egress Control 是安全底线。

### 8.4 双运行时策略

根据任务的安全等级选择执行环境：

- Low Sensitivity：使用 Container 运行时，启动延迟低、资源开销小。
- High Sensitivity：切换至 MicroVM 运行时，提供内核级隔离。切换通过配置项控制，业务 Agent 代码无感知。

### 8.5 默认拒绝原则

- 出网流量采用白名单机制，默认拒绝所有外部连接，仅放行已声明的目标地址。
- Skill 的文件系统访问范围默认限制为临时工作目录。
- 系统调用白名单按 Skill 类型预定义，未在清单中的 syscall 被 seccomp 拦截。

### 8.6 演进方向

- 出网管控从 IP 白名单演进为域名级 + SNI 过滤。
- 文件系统配额和 IOPS 限制。
- 高风险操作（数据库写操作、外部 API 调用涉及资金或权限变更）引入 Human-in-the-Loop 审批节点。
- AgentOps 体系建设：将 Monitor、Alert、Trace、回放、评测结果串联为运维闭环。

---

## Key Design Decisions

### DD-1: 分层架构

**Decision**：采用八层分层架构，每层独立演进，通过标准化接口交互。

**Context**：Agent 工程化的各项能力（执行、协议、知识、上下文、迭代、评测、网关、安全）在早期以单点需求出现。如果以单体方式实现，各能力将深度耦合，任一能力的变更都可能影响其他模块。

**Alternatives**：
1. 单体 Agent Platform：所有能力集成在同一进程中。
2. 微服务化：每个能力作为独立服务部署。
3. 分层架构：逻辑上分层，物理部署可按需组合。

**Rationale**：选择分层架构。分层提供了清晰的职责边界和演进独立性，同时不强制微服务化的部署复杂度。在逻辑分层的基础上，物理部署可根据负载特征选择集中部署或独立部署。

**Consequences**：层间接口需要保持向后兼容。任一层的接口变更需通过接口版本管理来控制影响范围。

### DD-2: 事件溯源作为 Runtime 状态管理基础

**Decision**：Runtime 的状态管理采用事件溯源（Event Sourcing）模式。

**Context**：Agent 执行过程涉及多轮模型推理和工具调用，中间状态复杂且需要支持审计、回放和恢复。

**Alternatives**：
1. 仅在关键节点保存状态快照。
2. 将所有执行事件持久化为不可变事件流。

**Rationale**：选择事件溯源。快照模式在需要回放和轨迹级评测时信息不足，且状态重建依赖最后一次快照的完整性。事件流提供了完整的审计线索，支持任意时间点的状态重建，并且是 Evaluation 层轨迹评级的直接数据源。

**Consequences**：事件存储量随执行次数线性增长，需要设计事件流的归档和压缩策略。Checkpoint 机制用于减少恢复时的事件回放量。

### DD-3: 能力（MCP）与知识（Skill）的抽象分离

**Decision**：将"动作能力"和"方法论知识"抽象为不同的工程概念——MCP 承载确定性调用，Skill 承载需要模型推理的方法论。

**Context**：早期实践中，工具调用和领域知识混合管理，导致 Tool Contract 膨胀（包含业务规则描述而非接口契约），模型在选择工具时混淆"该做什么"和"怎么判断"。

**Alternatives**：
1. 不区分，所有能力统一为 Tool。
2. 区分为 Tool 和 Skill，分别管理。

**Rationale**：选择方案 2。分开管理后，Tool Contract 回归纯粹的接口契约角色（输入输出约束），Skill 承担方法论指引的角色（包含判断逻辑和流程描述）。Runtime 在调度时可以根据类型采取不同策略。

**Consequences**：增加了一层概念模型的复杂度，需要开发者理解两者的区别并遵循分类规则。收益是 Tool Contract 的稳定性和 Skill 的可移植性。

### DD-4: AG-UI 统一 A2A 输出

**Decision**：Agent 间的调用回传采用 AG-UI 事件范式，而非独立的 A2A 响应格式。

**Context / Alternatives / Rationale / Consequences**：（参见 Layer 2.7 节）

### DD-5: 默认拒绝的安全策略

**Decision**：沙箱的出网流量采用默认拒绝 + 白名单放行策略。

**Context**：Skill 执行模型生成的代码，代码行为不可预知。即使在隔离的文件系统和内核环境中，不受控的出网流量仍可导致数据外泄。

**Alternatives**：
1. 默认放行 + 黑名单拦截。
2. 默认拒绝 + 白名单放行。

**Rationale**：选择默认拒绝。在模型生成代码的场景下，无法穷举所有可能的恶意行为。黑名单模式的安全假设是已知所有攻击模式，对于 AI 生成代码该假设不成立。

**Consequences**：合法的外部网络调用需要在 Skill 声明中预先注册目标地址，增加了 Skill 开发的上线步骤。该代价在安全和合规约束下可接受。

---

## Trade-offs

### T1: 事件流的完整性 vs 存储成本

完整记录每次执行的细粒度事件流带来了存储成本的线性增长。当前策略：全量保留近 30 天的事件流以支持实时审计和回放；超过 30 天的事件流经压缩和聚合后归档，仅保留关键事件（状态转换、工具调用摘要、异常事件）。

### T2: Context 缓存的时效性 vs 推理成本

缓存 Static Segment 和 Project Segment 降低了重复推理成本，但当 Tool Definition 或系统指令变更时，缓存失效窗口内可能出现不一致。失效策略选择版本号触发主动失效，而非 TTL 被动过期，确保变更后首次推理即使用最新配置。

### T3: MicroVM 的隔离强度 vs 启动延迟

MicroVM 提供最强隔离，但冷启动延迟（数百毫秒级）高于容器（毫秒级）。双运行时策略通过按需选择执行环境来平衡：低敏感任务使用容器获得低延迟，高敏感任务承担 MicroVM 冷启动代价换取强隔离。

### T4: 分层架构的清晰性 vs 跨层调用的性能损失

严格的分层意味着一次 Tool Invocation 需要经过 Protocol → Gateway → Tool Provider 的完整链路，相比直接调用增加了网络跳数和序列化开销。在 Agent 执行场景下（单次执行包含数次到数十次 Tool Call，每次 Tool Call 的实际执行时间远超网络延迟），分层带来的可治理性收益超过性能损失。对于高频、低延迟要求的 Tool，可通过本地 Tool Adapter 绕开网络调用，但保持相同的 Tool Contract 抽象。

---

## Reliability

### 故障模型与恢复策略

| 故障类型 | 检测方式 | 恢复策略 |
|---------|---------|---------|
| Runtime 进程崩溃 | 进程监控 + Health Check | 从最近 Checkpoint 恢复，通过事件流重建上下文 |
| 模型 API 不可用 | 请求超时 / 错误码 | Gateway 熔断，切换备用模型 |
| Tool 调用失败 | 超时 / 错误响应 | Retry with backoff；失败计入 Failure Budget；Budget 耗尽后交还控制 |
| 上下文窗口溢出 | Token 计数器 | 触发边界压缩；压缩失败则截断并标记 |
| Checkpoint 写入失败 | 存储写入异常 | 内存保留最近 Checkpoint，告警通知；不影响当前执行 |
| 沙箱逃逸 / 异常出网 | Egress Monitor 检测 | 终止沙箱实例，封锁来源 IP，生成安全事件 |

### 幂等性

- Tool Invocation 的重试需由 Tool Provider 声明是否支持幂等调用。支持幂等的 Tool 在 Contract 中标注 `idempotent: true`。
- 对于非幂等 Tool，Runtime 在重试前检查之前是否有成功的执行记录，避免重复执行。
- Durable Execution 的实现需要 Tool Provider 的幂等性支持或补偿机制配合。

---

## Scalability

### 水平扩展

- Runtime 实例无状态，支持水平扩展。通过 Execution ID 路由保证同一执行实例的事件写入顺序。
- Gateway 无状态，支持水平扩展。
- Capability Registry 读多写少，通过读副本扩展。

### 能力扩展

- 新 Tool 通过 Capability Registry 注册后，由 Gateway 动态加载 Tool Contract，无需重启 Runtime。
- 新 Agent 通过 Agent Registry 注册后，A2A 层可发现并调用。

### 协议扩展

- Protocol 层的接口版本化，新增协议能力通过新版本接口暴露，旧版本保持兼容。

---

## Observability

| 维度 | 实现方式 |
|------|---------|
| Trace | 每次执行分配全局唯一 Trace ID，跨 Runtime、Tool Call、模型调用传播 |
| Metrics | 执行成功率、平均轮次、Tool Call 延迟、模型 API 延迟、Failure Budget 触发率 |
| Audit Log | 所有经过 Gateway 的调用记录持久化，包含调用方、目标、参数哈希、结果状态 |
| Execution Visualization | 基于事件流生成执行时间线，展示每轮的模型推理、工具调用和状态转换 |
| Alert | Failure Budget 耗尽、沙箱异常出网、模型 API 错误率超阈值触发告警 |

---

## Security Considerations

| 安全域 | 措施 |
|--------|------|
| 代码执行 | 模型生成代码在沙箱中执行；沙箱提供内核、文件系统和出网三层隔离 |
| 数据访问 | 知识库检索需通过权限校验；检索结果注入上下文前过滤越权内容 |
| 工具调用 | 所有 Tool Invocation 经过 Gateway 鉴权；支持 Tool 级别的权限控制 |
| 出网管控 | 默认拒绝所有出网流量；白名单放行；出网流量日志审计 |
| 人工确认 | 高风险操作（数据写、涉及权限变更的外部 API 调用）引入 Human-in-the-Loop |
| 审计追溯 | 所有执行事件、Gateway 调用、沙箱操作持久化，支持按执行 ID、用户、时间范围检索 |

---

## Future Evolution

### Near-term

体系化评测流水线（Evaluation Pipeline）。当前 Context Engineering 和 Runtime 已相对扎实，但缺乏系统化的评测能力来量化变更效果。建设范围：标准测试集构建、轨迹级评分、机器判分 + 规则 + 人工抽检、生产失败自动转回归、评测接入发布门禁。

### Mid-term

- Durable Execution：基于已有的事件溯源和 Checkpoint 能力，实现长任务在失败、重启、断线后的幂等续跑。关键依赖：Tool Provider 的幂等性支持或补偿机制。
- A2A 可执行协作：从注册发现演进为任务委派、子任务生命周期管理和取消传播。
- 统一策略层：将模型选择、Tool 路由、限流、审计策略收敛到 Gateway Control Plane 统一管理。

### Long-term

Knowledge OS：从检索能力向知识组织、治理、复利方向演进。包括实体关系抽取与图谱构建、知识的生命周期管理、编译式知识和企业记忆的复利增长机制。

---

*本文档基于 AI Agent 工程化方向的技术积累与设计决策整理，涵盖 Runtime、Protocol、Knowledge、Context Engineering、Engineering/Iteration、Evaluation、Gateway、Governance/Security 八个技术层。技术路线与 MCP、A2A、AG-UI、Agent Skills、Durable Execution 等方向一致。*
