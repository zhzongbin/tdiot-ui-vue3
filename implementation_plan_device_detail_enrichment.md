# 设备详情页功能丰富实施计划

## 1. 目标
丰富设备详情页 (`src/views/portal/devices/detail.vue`) 的展示内容，使用户能够查看设备的完整服务端配置信息，并通过图表直观分析设备的历史运行数据。

## 2. 功能模块

### 2.1 服务端属性展示 (Server Attributes)
- **功能描述**：以列表形式展示设备的服务端属性。
- **展示内容**：
  - 属性键参考设备列表页，用同一套翻译方案：DeviceNo,MQTT_CLIENT_ID,DeviceName,name,ProviceNo,StationNo,StationName,label,灾害类型,city,county,town,village,建设级别,建设年份,location,Longitude,Latitude,ower,manufacturer,监测类型,DeviceType,project



### 2.2 时序数据可视化 (Telemetry Visualization)
- **功能描述**：展示设备遥测数据的历史趋势折线图。
- **功能细节**：
  - **时间范围选择**：提供快捷选项（最近6小时、1天、7天）及自定义时间段。
  - **数据指标筛选**：自动获取设备所有可用的遥测键（Keys），允许用户多选需要展示的指标。
  - **图表交互**：支持缩放、Tooltip 悬浮提示、图例切换。
  - **自动刷新**：切换时间或指标时自动重新加载数据。

## 3. 技术方案

### 3.1 API 接口
使用 `src/api/tb/telemetry.ts` 中的现有接口：
- `getAttributesByScope(entityId, Scope.SERVER_SCOPE)`: 获取服务端属性列表。
- `getTimeseriesKeys(entityId)`: 获取设备所有可用的遥测数据键名。
- `getTimeseries(params)`: 获取指定时间范围和键名的历史数据。

### 3.2 UI 组件
- **表格组件**：使用 Ant Design Vue 的 `Table` 组件展示属性。
- **图表库**：使用项目已集成的 `ECharts` (v5) 进行数据渲染。
- **布局**：在现有详情页下方新增两个 `a-card` 容器。

## 4. 实施步骤

### 阶段一：服务端属性模块
1.  在 `detail.vue` 中引入 `getAttributesByScope` API。
2.  新增“服务端属性”卡片区域。
3.  实现数据加载逻辑：页面加载时获取 `SERVER_SCOPE` 属性。
4.  渲染表格，格式化时间戳。

### 阶段二：时序数据图表模块
1.  在 `detail.vue` 中引入 `getTimeseriesKeys` 和 `getTimeseries` API。
2.  引入 `ECharts` 并封装基础图表配置。
3.  新增“历史趋势”卡片区域，包含工具栏（时间选择器、指标下拉框）。
4.  实现交互逻辑：
    - 初始化时获取所有 Keys，默认选中前 3 个。
    - 默认加载最近 24 小时数据。
    - 监听筛选条件变化，触发数据重载与图表更新。

## 5. 预期效果
用户进入设备详情页后，页面结构如下：
1.  **基础信息** (现有)
2.  **服务端属性** (新增)：清晰列出配置参数。
3.  **历史趋势** (新增)：交互式折线图，支持多维度数据分析。
