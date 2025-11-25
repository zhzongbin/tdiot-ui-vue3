---
trigger: always_on
---

# AI 项目规则（tdiot-ui-vue3）

本规则用于指导 AI 在本仓库进行二次开发时的行为，确保最大限度避免修改上游（ThingsBoard 前端）原文件，从而降低上游更新时的冲突风险。
## 使用中文做项目计划

## 目标
- 避免修改原项目文件，优先通过扩展与覆写实现新功能。
- 利用现有的动态加载点（路由、国际化等）进行无侵入扩展。
- 必要时使用构建期别名进行“精确覆写”，而非直接改动源文件。
- 所有变更必须可验证（构建/类型/格式检查）。

## 总原则
- 不修改原有模块的源文件；新增功能以模块形式放入扩展目录。
- 仅在稳定入口点做最小化挂载；能不改入口就不改。
- 覆写旧行为优先使用 Vite alias 精确映射，不直接改原文件。
- 保持安全：不提交密钥，不输出敏感信息。

## 扩展位置与约定
- 路由模块：将新路由放在 `src/router/routes/modules/`，路由会被自动加载（`src/router/routes/index.ts:8`）。
  - 视图页面建议集中在 `src/views/tdiot/**`。
  - 示例结构：`src/router/routes/modules/tdiot.ts` 引用 `src/views/tdiot/*`。
- 国际化词条：新增到 `src/locales/lang/zh-CN/tdiot/**` 与 `src/locales/lang/en/tdiot/**`，会被动态收集（`src/locales/lang/zh_CN.ts:4-10`）。
- 业务 API：`src/api/tdiot/**`。
- Pinia Store：`src/store/modules/tdiot/**`。
- 样式：尽量使用局部样式（SFC `<style scoped>`），避免改动 `src/design/index.less`。

## 禁止与限制
- 不修改以下上游核心目录的既有文件内容：
  - `src/views/tb/**`
  - `src/router/**`（仅允许新增 `modules/*.ts` 路由模块文件）
  - `src/locales/lang/**`（仅允许新增词条文件）
- 不更改 `src/main.ts`、`vite.config.ts` 等入口文件，除非为“精确覆写”所必须且变更极小且向前兼容。

## 覆写策略（必要时）
- 使用 Vite alias 的“精确映射”替代直接修改原文件（参考 `vite.config.ts:18-32` 的 `resolve.alias`）。
- 覆写示例（说明性）：将原路径 `/@/views/tb/device/list.vue` 映射到你的覆写文件 `src/overrides/tb/device/list.vue`。
- 只为需要覆写的特定 import 增加 alias，不广泛替换目录，确保影响面最小。

## 菜单与权限集成
- 新增路由将被纳入 `asyncRoutes`，并与后端菜单合并（`src/store/modules/permission.ts:171`），无需改动菜单构建逻辑。



## 命名与目录建议
- 扩展前缀：使用 `tdiot` 作为新模块与目录前缀（例如 `src/views/tdiot/*`、`src/api/tdiot/*`）。
- 路由命名：`Tdiot*`，设置合理的 `meta.title`、`icon`、`affix` 等，符合现有约定。

## 安全与合规
- 不提交任何密钥、令牌、证书等敏感信息。
- 不在日志或错误消息中输出敏感数据。

## 触发点参考（代码索引）
- 路由模块自动加载：`src/router/routes/index.ts:8`
- 基础路由注册：`src/router/index.ts:20-28`
- 登录后动态添加路由：`src/store/modules/user.ts:168-176`
- 菜单来源与过滤：`src/router/menus/index.ts:54-80`、`src/store/modules/permission.ts:171-181`
- 国际化动态聚合：`src/locales/lang/zh_CN.ts:4-10`
- Vite alias 入口：`vite.config.ts:18-32`

## 执行流程示例（新增“资产与地图”）
1. 新建 `src/views/tdiot/assets/index.vue`、`src/views/tdiot/map/index.vue`。
2. 新建路由模块 `src/router/routes/modules/tdiot.ts`，引用上述视图。
3. 新建词条文件 `src/locales/lang/zh-CN/tdiot/*.ts` 与 `src/locales/lang/en/tdiot/*.ts`。
4. 运行 `npm run dev` 验证路由、菜单、国际化展示。
5. 运行 `npm run type:check` 与 `npm run lint:all` 确认质量。

## 例外与变更控制
- 如确需改动入口文件或上游文件：
  - 评估是否可通过新增模块/alias 替代；
  - 若不可替代，改动必须最小化、向前兼容，并在提交说明中标注“上游兼容性影响点”。