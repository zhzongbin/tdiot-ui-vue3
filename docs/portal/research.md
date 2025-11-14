# 项目结构与实现参考

## 路由与导航
- 路由创建：`src/router/index.ts`
- 历史模式封装：`src/router/helper/routeHelper.ts`
- 路由模块扫描：`src/router/routes/index.ts`
- 基础与异常：`src/router/routes/basic.ts`
- 布局常量：`src/router/constant.ts`
- 业务模块（ThingsBoard）：`src/router/routes/modules/tb.ts`
  - 设备列表：`src/router/routes/modules/tb.ts:156-166`
  - 资产列表：`src/router/routes/modules/tb.ts:168-177`

## 菜单生成
- 菜单来源：`src/router/menus/index.ts`
- 路由转菜单：`src/router/helper/menuHelper.ts`
- 布局侧菜单：`src/layouts/default/menu/useLayoutMenu.ts`

## 通用表格组件
- 入口：`src/components/Table/index.ts`
- 核心：`src/components/Table/src/BasicTable.vue`
- Hook：`src/components/Table/src/hooks/useTable.ts`
- 典型用法：设备列表 `src/views/tb/device/list.vue:219-229`

## 设备与资产 API
- 设备 API：`src/api/tb/device.ts`
  - 租户设备信息列表：`src/api/tb/device.ts:125-130`
  - 客户设备信息列表：`src/api/tb/device.ts:146-151`
- 资产 API：`src/api/tb/asset.ts`
  - 租户资产信息列表：`src/api/tb/asset.ts:100-105`
  - 客户资产信息列表：`src/api/tb/asset.ts:107-112`

## 遥测与属性 API
- 封装：`src/api/tb/telemetry.ts`
  - 最新时序：`src/api/tb/telemetry.ts:82-88`
  - 历史时序：`src/api/tb/telemetry.ts:90-95`
  - 时序键名：`src/api/tb/telemetry.ts:62-66`
  - 属性按作用域：`src/api/tb/telemetry.ts:75-80`

## 图表库与使用
- ECharts 依赖：`package.json:57`
- 封装 Hook：`src/hooks/web/useECharts.ts`
- 注册：`src/utils/lib/echarts.ts`
- 页面示例：
  - 折线图：`src/layouts/views/desktop/analysis/components/VisitAnalysis.vue`
  - 柱状图：`src/layouts/views/desktop/analysis/components/VisitAnalysisBar.vue`
  - 饼图：`src/layouts/views/desktop/analysis/components/SalesProductPie.vue`

## 地图库与地图页
- 百度地图 Hook：`src/hooks/web/useBMap.ts:26`
- 案例组件：`src/views/tb/desktop/components/chart/GeoMap.vue`
  - 数据订阅：`src/views/tb/desktop/components/chart/GeoMap.vue:73-121`
  - 处理消息：`src/views/tb/desktop/components/chart/GeoMap.vue:152-168`
  - 渲染 Marker：`src/views/tb/desktop/components/chart/GeoMap.vue:170-197`
- 地图 AK 配置：建议在 `.env` 添加 `VITE_BAIDU_MAP_AK` 并在使用处调用 `useBMap(import.meta.env.VITE_BAIDU_MAP_AK)`。

## 新增文件（前台）
- 路由模块：`src/router/routes/modules/portal.ts`
- 表格页：`src/views/portal/entities/index.vue`
- 地图页：`src/views/portal/map/index.vue`
- 文案：`src/locales/lang/zh-CN/routes/portal.ts`、`src/locales/lang/en/routes/portal.ts`

## 预览
- 本地开发：`pnpm dev`
- 访问地址：`http://localhost:3101/vue`