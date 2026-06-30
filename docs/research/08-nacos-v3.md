# Nacos V3：把配置、发现与扩展能力从运行时里解耦

## 为什么要做

Vela 是多进程、多能力、多 provider 的 Agent 平台。Biz、Engine、Workers、MCP、Skill、A2A、沙箱、模型和对象存储都需要配置和发现机制。如果所有配置都写在本地环境变量或数据库里，跨环境部署和平台化扩展会很难。

Nacos V3 在项目中的价值，是把配置中心、服务注册发现和部分能力发现从运行时代码中解耦出来。

## 要解决的问题

项目要解决三个问题：配置如何跨环境管理，Biz/Engine 服务如何注册发现，MCP/Skill/A2A 这类扩展能力如何从外部系统接入。

这些问题都不适合写死在 Agent Loop 中。否则每增加一种部署形态或能力来源，都要改主流程。

## 设计目标

Vela 的设计目标是可选接入 Nacos，而不是强依赖 Nacos。源码中配置 provider、MCP provider、Skill 同步和 A2A provider 都通过开关启用。Nacos 不存在时，系统仍可以使用环境变量、数据库和本地 Skill。

这说明作者把 Nacos 当作平台化能力来源，而不是业务逻辑的一部分。

## 核心思想

核心思想是 provider 化。配置、服务注册、MCP、Skill、A2A 都可以通过 Nacos SDK 接入，但 Engine 和 Biz 不应直接依赖 Nacos 的细节。

这种做法让 Nacos 成为运行时基础设施，而不是 Agent 逻辑的一部分。配置来自哪里、工具从哪里发现、远端 Agent 从哪里注册，都应该在 provider 层解决。

## 架构设计

Nacos 相关能力可以分成四类：

- 配置中心：通过配置源读取 Nacos properties，并映射到应用设置。
- 服务注册：Biz 和 Engine 启动时可注册为 `vela-biz` 和 `vela-engine`。
- MCP 发现：Engine 可选择 Nacos MCP provider 装载平台工具。
- Skill 与 A2A：Engine 可同步 Nacos Skill，也可通过 Nacos A2A provider 发现远端 Agent。

源码中没有充分展开 Nacos V3 内部协议、命名空间隔离细节或完整热更新闭环，因此这些部分不能被写成当前事实。

## 为什么这样设计

配置中心和服务发现属于基础设施层，不应该散落在业务代码里。Vela 通过 `ConfigProvider` 和 Nacos client 适配，把基础设施差异隐藏起来。

Nacos 对 MCP、Skill、A2A 的意义更大。它可以成为能力注册中心，让平台能力不必全部来自数据库或本地文件。对于多环境、多团队、多 Agent 的平台，这是比硬编码更可持续的方案。

## 项目体现

源码体现包括：

- `backend/shared/nacos_client.py` 负责 Nacos client、服务注册、注销和注册开关。
- `backend/shared/nacos_config_source.py` 在启用 Nacos 配置 provider 时读取配置并映射到应用设置。
- `backend/shared/config_provider.py` 体现配置来源的 provider 抽象。
- `backend/engine/providers/nacos_config.py` 体现 Engine 侧 Nacos 配置 provider。
- `backend/biz/main.py`、`backend/engine/main.py` 体现 Biz 和 Engine 启动时的 Nacos 初始化与服务注册。
- `backend/engine/providers/__init__.py` 体现 Nacos MCP provider 的可选加载。
- `backend/engine/api/internal/turns.py` 中的 provider 装载链路体现 Nacos Skill 与 A2A 的接入点。

## Trade-off

引入 Nacos 能提升平台化能力，但也增加部署复杂度和运行依赖。开发环境可以只用 `.env`，但生产环境一旦启用 Nacos，就要考虑命名空间、权限、可用性、配置回滚和 SDK 版本兼容。

另一个取舍是热更新。源码已经有配置源和启动加载，但没有完整证明所有配置都能在运行中热更新。把“可从 Nacos 读取”误解成“所有配置实时热更新”会带来错误预期。

## 优点

Nacos provider 化让 Vela 的基础设施能力更开放。服务注册、配置、MCP、Skill、A2A 可以逐步纳入统一治理，而不需要一次性重写核心逻辑。

这种设计也便于私有化和多环境部署。不同环境可以选择不同 provider，不影响 Agent Loop 的核心执行模型。

## 缺点

当前源码对 Nacos V3 的呈现主要是接入层，缺少完整运维策略说明。命名空间、健康检查细节、配置监听、灰度发布、权限模型和失败降级策略还需要更多工程闭环。

Nacos 能力分散在 shared、engine providers、main 初始化和第三方 `vela-nacos-*` 包中，读者需要跨模块理解。

## 可以如何优化

可以把 Nacos 接入整理成统一运行手册：哪些配置支持热更新，哪些只在启动时读取，服务注册失败如何降级，MCP/Skill/A2A provider 多久刷新，命名空间如何对应租户或环境。

还可以增加 provider 健康检查和可观测性，明确显示当前配置来源、服务注册状态、MCP/Skill/A2A 同步版本。

## 工程经验

Nacos 这类基础设施要做成可选 provider，而不是写死依赖。这样本地开发、单机部署、私有化部署和平台化部署可以共用同一套业务代码。

配置中心不是简单替代 `.env`。它需要权限、回滚、审计、热更新边界和故障预案。

## 踩坑总结

不要因为接入了 Nacos 就假设所有能力都自动服务发现和热更新。源码目前能支撑的是可选配置源、服务注册、MCP/Skill/A2A provider 接入点，而不是完整运维闭环。

不要把 Nacos 逻辑渗透到 Agent Loop。Vela 当前通过 provider 隔离，这是正确方向。

## 值得分享的观点

对 Agent 平台来说，Nacos 不只是配置中心，也可以是能力注册中心。工具、Skill 和远端 Agent 都需要被发现、被治理、被替换。

## 一句话总结

Vela 把 Nacos V3 用作可选基础设施 provider，解耦配置、服务注册和能力发现，但热更新与运维治理仍需要进一步闭环。
