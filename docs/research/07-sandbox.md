# Sandbox：让 Agent 安全执行代码的隔离运行面

## 为什么要做

Agent 一旦拥有代码执行能力，就不再只是文本系统。它可能读写文件、运行脚本、生成文档、访问网络、安装依赖、产生制品。没有 Sandbox，代码执行会直接威胁宿主环境、用户数据和平台稳定性。

Vela 把代码执行放进 Sandbox，是为了把模型生成代码的能力限制在隔离、可清理、可收集产物的运行面里。

## 要解决的问题

Sandbox 要解决安全、生命周期、文件系统、依赖、网络、产物和取消问题。代码要能运行，但不能访问宿主；产物要能收集，但不能随意写；会话要能复用，但不能无限占用；网络要能控制，但不能静默放开。

这和普通函数工具不同。代码执行是高风险工具，必须有更强的隔离模型。

## 设计目标

Vela 的目标是 provider-neutral。Engine 不直接绑定某个沙箱实现，而是依赖统一能力：创建会话、执行代码、上传文件、收集产物、销毁会话、取消执行、声明能力。

源码中支持 E2B 和 OpenSandbox 两条路径，Docker 和 Firecracker 在工厂层明确没有实现。也就是说，Vela 当前没有把本地 Docker 当作默认沙箱 provider。

## 核心思想

核心思想是“代码可以执行，但执行环境必须可替换、可探测、可销毁”。Sandbox Provider 需要声明能力，启动后做 contract probe，检查目录、运行时、系统依赖和工具链是否满足预期。

Vela 还把 Skill 和 Sandbox 结合起来。文档类代码生成任务必须先加载对应 Skill，这说明作者认为代码执行不是孤立能力，必须配合领域操作规程。

## 架构设计

Sandbox 设计包含几个层次：

- Provider 抽象：统一 E2B、OpenSandbox 等实现。
- Session 生命周期：按会话创建、复用、执行多次、销毁或取消。
- 文件系统契约：输入、工作目录、输出目录有明确约定，产物只从输出路径收集。
- Runtime contract：检查 Python、Node、LibreOffice、Pandoc、Poppler、字体等依赖。
- Artifact 回收：执行后把输出目录中的文件持久化成平台 artifact。
- 风险控制：无 provider 时不本地降级，高风险工具需要策略约束。

## 为什么这样设计

不用直接本地执行的原因很明确：Agent 代码由模型生成，不可信。本地执行会让模型获得宿主权限。源码中也能看到，没有 sandbox provider 时，代码执行工具返回不可用，而不是退回本地 shell。

为什么不直接使用 Docker 作为当前 provider，源码没有给出完整论证，只能从实现推导：项目当前选择 E2B 和 OpenSandbox，是因为它们提供了更明确的会话、文件、生命周期和远端隔离能力；Docker provider 在工厂中标注未实现，说明当前阶段没有把 Docker 纳入可用运行面。

## 项目体现

源码体现包括：

- `backend/engine/sandbox/protocol.py` 定义 provider-neutral 的执行、上传、收集和生命周期能力。
- `backend/engine/sandbox/factory.py` 根据配置选择 E2B 或 OpenSandbox；Docker 和 Firecracker 未实现。
- `backend/engine/sandbox/providers/e2b_provider.py` 体现 E2B 云端代码解释器接入、contract probe、产物收集和网络策略限制。
- `backend/engine/sandbox/providers/opensandbox_provider.py` 体现自托管 OpenSandbox、资源配置、pause/resume/reconnect/snapshot/metrics/update_network 等能力。
- `backend/engine/sandbox/contract.py` 体现运行时依赖探测。
- `docker/sandbox/README.md` 体现 OpenSandbox 镜像、依赖预装、网络策略和输出目录约定。
- `backend/engine/tools/builtins/code_execution.py` 体现工具层对沙箱、Skill、附件和 artifact 的集成。

## Trade-off

沙箱带来安全和可治理性，但也带来延迟、成本和复杂度。创建会话、上传附件、预加载 Skill 资产、收集产物都会增加执行时间。远端沙箱还依赖外部服务可用性。

复用 session 可以提升效率，但会带来状态污染和资源占用风险。每次全新创建更干净，但成本更高。

## 优点

Vela 的沙箱设计优点是没有把代码执行和宿主混在一起。它有 provider 抽象，有运行时 contract，有输出目录约束，有 artifact 持久化，有无 provider 时的安全拒绝。

OpenSandbox 路径还提供更丰富的生命周期和网络控制能力，适合未来做企业级隔离和资源治理。

## 缺点

当前 Docker provider 未实现，意味着本地私有化部署如果不使用 OpenSandbox 或 E2B，就无法直接启用代码执行。网络隔离也不是所有 provider 能力完全一致，E2B 路径中部分网络策略能力受实现限制。

沙箱产物和文档类任务依赖较多系统工具，环境一致性需要持续验证。

## 可以如何优化

可以增加 sandbox warm pool，降低首轮执行延迟。可以把 contract probe 结果纳入健康检查和告警。网络 egress 应在基础设施层加强，而不只依赖 provider 参数。

未来也可以补齐 Docker 或 Firecracker provider，但前提是明确资源限制、文件隔离、网络策略、生命周期回收和并发配额。

## 工程经验

代码执行工具必须默认不可信。不要让模型生成的代码碰到宿主文件系统，不要让产物随意散落，也不要把网络默认放开。

文档、表格、PDF 这类产物生成任务，真正难点不是运行代码，而是运行环境和领域约束。Vela 要求先加载 Skill，是很实用的经验。

## 踩坑总结

不要在没有沙箱 provider 时自动降级到本地执行。这个便利性会变成严重安全问题。

不要假设所有沙箱 provider 能力一致。网络策略、pause/resume、snapshot、资源限制和依赖环境都需要 capability 和 contract 检查。

## 值得分享的观点

Sandbox 是 Agent 工程化的安全地基。没有隔离运行面，代码解释器就是把模型输出接到了生产机器上。

## 一句话总结

Vela 的 Sandbox 通过 E2B/OpenSandbox provider、运行时契约和产物边界，让 Agent 代码执行进入可隔离、可回收、可治理的运行环境。
