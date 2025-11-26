<template>
  <PageWrapper :title="t('routes.portal.deviceDetail')">
    <div class="space-y-6">
      <div class="flex gap-2">
        <a-button type="primary" @click="goRelatedAssets">查看所属地灾点</a-button>
      </div>
      <a-card :title="t('routes.portal.devices')">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('basic')" :key="key" :label="getFieldAlias(key)">
            {{ getFieldAlias(key) }}: {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.device.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('device')" :key="key" :label="getFieldAlias(key)">
            {{ getFieldAlias(key) }}: {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.site.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('site')" :key="key" :label="getFieldAlias(key)">
            {{ getFieldAlias(key) }}: {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.geo.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="getFieldAlias('Longitude')">
            {{ getFieldAlias('Longitude') }}: {{ displayValue(detail['Longitude']) }}
            <a @click="openMap(detail['Longitude'], detail['Latitude'])">{{ displayValue(detail['Longitude']) }}</a>
          </a-descriptions-item>
          <a-descriptions-item :label="getFieldAlias('Latitude')">
            {{ getFieldAlias('Latitude') }}: {{ displayValue(detail['Latitude']) }}
            <a @click="openMap(detail['Longitude'], detail['Latitude'])">{{ displayValue(detail['Latitude']) }}</a>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card title="服务端属性" :loading="serverAttributesLoading">
        <template #extra>
          <a-button type="link" @click="refreshAttributes">刷新</a-button>
        </template>
        <a-table
          :columns="serverAttrColumns"
          :dataSource="serverAttributeList"
          :pagination="false"
          size="small"
          rowKey="key"
          bordered
        />
      </a-card>

      <a-card title="历史趋势" :loading="chartLoading">
        <div class="mb-2 flex items-center gap-2 justify-end">
          <RangePicker
            v-model:value="customTimeRange"
            show-time
            @change="handleCustomTimeChange"
            style="width: 320px"
          />
          <a-radio-group v-model:value="timeRange" button-style="solid" @change="handleTimeRangeChange">
            <a-radio-button value="1h">1小时</a-radio-button>
            <a-radio-button value="24h">24小时</a-radio-button>
            <a-radio-button value="7d">7天</a-radio-button>
          </a-radio-group>
        </div>

        <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
          <a-tab-pane key="monitoring" tab="监测数据">
            <div class="mb-2 flex justify-end">
              <a-select
                v-model:value="selectedKeys"
                mode="multiple"
                placeholder="选择数据指标"
                style="min-width: 200px; max-width: 400px"
                @change="handleChartFilterChange"
                :maxTagCount="2"
              >
                <a-select-option v-for="key in telemetryKeys" :key="key" :value="key">{{ key }}</a-select-option>
              </a-select>
            </div>
            <div ref="chartRef" style="width: 100%; height: 400px"></div>
          </a-tab-pane>
          <a-tab-pane key="status" tab="设备状态">
            <div ref="statusChartRef" style="width: 100%; height: 400px"></div>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </div>
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalDeviceDetailPage',
  };
</script>
<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { findRelationListByToAndType } from '/@/api/tb/relation';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { router } from '/@/router';
  import { useTabs } from '/@/hooks/web/useTabs';
  import dayjs, { Dayjs } from 'dayjs';
  import { DEVICE_FIELDS } from '/@/views/portal/config/attributes';
  import { getAttributesByScope, getTimeseriesKeys, getTimeseries } from '/@/api/tb/telemetry';
  import { Scope } from '/@/enums/telemetryEnum';
  import { useECharts } from '/@/hooks/web/useECharts';
  import { Ref, computed } from 'vue';
  import { Tabs, TabPane, Select, Radio, DatePicker } from 'ant-design-vue';

  const ATabs = Tabs;
  const ATabPane = TabPane;
  const ASelect = Select;
  const ASelectOption = Select.Option;
  const ARadioGroup = Radio.Group;
  const ARadioButton = Radio.Button;
  const RangePicker = DatePicker.RangePicker;

  const { t } = useI18n();
  const detail = ref<any>({});
  const { setTitle } = useTabs();

  // Server Attributes
  const serverAttributesMap = ref<Record<string, any>>({});
  const serverAttributesLoading = ref(false);

  // 指定展示的字段列表
  const TARGET_ATTR_KEYS = [
    'DeviceNo',
    'MQTT_CLIENT_ID',
    'DeviceName',
    'name',
    'ProviceNo',
    'StationNo',
    'StationName',
    'label',
    '灾害类型',
    'city',
    'county',
    'town',
    'village',
    '建设级别',
    '建设年份',
    'location',
    'Longitude',
    'Latitude',
    'ower',
    'manufacturer',
    '监测类型',
    'DeviceType',
    'project',
  ];

  const serverAttrColumns = [
    { title: '属性名', dataIndex: 'alias', key: 'alias', width: 150 },
    { title: '属性键', dataIndex: 'key', key: 'key', width: 150 },
    { title: '属性值', dataIndex: 'value', key: 'value' },
    { title: '最后更新时间', dataIndex: 'lastUpdateTs', key: 'lastUpdateTs', width: 180 },
  ];

  const serverAttributeList = computed(() => {
    return TARGET_ATTR_KEYS.map((key) => {
      const fieldDef = DEVICE_FIELDS.fields.find((f) => f.key === key);
      const alias = fieldDef?.alias || key;

      // 优先从 serverAttributesMap 取（包含时间戳），如果是 Entity Field (name, label) 则从 detail 取
      let value = serverAttributesMap.value[key]?.value;
      let lastUpdateTs = serverAttributesMap.value[key]?.lastUpdateTs;

      if (['name', 'label'].includes(key)) {
        value = detail.value[key];
        // Entity fields don't have update time in this context usually, or we use createdTime
        lastUpdateTs = null;
      } else if (value === undefined && detail.value[key] !== undefined) {
        // Fallback to detail if not in server attributes (e.g. if it was loaded via entity query but not server scope query)
        value = detail.value[key];
      }

      return {
        key,
        alias,
        value: displayValue(value),
        lastUpdateTs: lastUpdateTs ? dayjs(lastUpdateTs).format('YYYY-MM-DD HH:mm:ss') : '-',
      };
    });
  });

  // Telemetry
  const activeTabKey = ref('monitoring');
  const chartRef = ref<HTMLDivElement | null>(null);
  const statusChartRef = ref<HTMLDivElement | null>(null);

  const { setOptions: setMonitoringOptions, resize: resizeMonitoring } = useECharts(chartRef as Ref<HTMLDivElement>);
  const { setOptions: setStatusOptions, resize: resizeStatus } = useECharts(statusChartRef as Ref<HTMLDivElement>);

  const telemetryKeys = ref<string[]>([]);
  const selectedKeys = ref<string[]>([]);
  const timeRange = ref<string>('24h');
  const customTimeRange = ref<[Dayjs, Dayjs] | undefined>(undefined);
  const chartLoading = ref(false);

  // Status Keys Configuration
  const STATUS_KEYS_CONFIG = [
    { key: 'S1_ZT_1_temp', alias: '温度', axis: 'temp' },
    { key: 'S1_ZT_1_solar_volt', alias: '光伏电压', axis: 'volt' },
    { key: 'S1_ZT_1_humidity', alias: '湿度', axis: 'humidity' },
    { key: 'S1_ZT_1_ext_power_volt', alias: '供电电压', axis: 'volt' },
  ];

  onMounted(async () => {
    const deviceId = router.currentRoute.value.params.deviceId as string;
    const page = await findEntityDataByQuery({
      entityFilter: {
        type: 'singleEntity',
        singleEntity: { id: deviceId, entityType: EntityType.DEVICE },
      },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      latestValues: [
        { type: 'ATTRIBUTE', key: 'active' },
        { type: 'ATTRIBUTE', key: 'lastActivityTime' },
        ...DEVICE_FIELDS.fields
          .filter((f) => !['name', 'type', 'label', 'active', 'lastActivityTime'].includes(f.key))
          .map((f) => ({ type: 'SERVER_ATTRIBUTE', key: f.key })),
      ],
      pageLink: { page: 0, pageSize: 1 },
    });
    const rec = page.data?.[0];
    detail.value = mapEntityRow(rec);
    const name = detail.value?.name;
    if (name) {
      await setTitle(name);
    }
    refreshAttributes();
    fetchTelemetryKeys();
  });

  function refreshAttributes() {
    fetchServerAttributes();
  }

  async function fetchServerAttributes() {
    const deviceId = router.currentRoute.value.params.deviceId as string;
    if (!deviceId) return;
    serverAttributesLoading.value = true;
    try {
      const res = await getAttributesByScope({ id: deviceId, entityType: EntityType.DEVICE }, Scope.SERVER_SCOPE);
      // Convert array to map for easier lookup
      const map: Record<string, any> = {};
      res.forEach((item) => {
        if (item.key) map[item.key] = item;
      });
      serverAttributesMap.value = map;
    } catch (e) {
      console.error(e);
    } finally {
      serverAttributesLoading.value = false;
    }
  }

  async function fetchTelemetryKeys() {
    const deviceId = router.currentRoute.value.params.deviceId as string;
    if (!deviceId) return;
    try {
      const keys = await getTimeseriesKeys({ id: deviceId, entityType: EntityType.DEVICE });
      // Filter out metadata keys
      const filteredKeys = keys.filter((k) => !['did', 'ts', 'entityId'].includes(k));
      telemetryKeys.value = filteredKeys;

      if (filteredKeys.length > 0) {
        // Auto-select keys that match known patterns (QJ, LF, JS)
        const autoSelected = filteredKeys.filter((k) => k.includes('QJ') || k.includes('LF') || k.includes('JS'));

        // If no known patterns found, fallback to first few
        if (autoSelected.length > 0) {
          selectedKeys.value = autoSelected;
        } else {
          selectedKeys.value = filteredKeys.slice(0, 3);
        }

        fetchChartData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleTabChange() {
    // Resize charts when tab changes to ensure correct rendering width
    setTimeout(() => {
      if (activeTabKey.value === 'monitoring') resizeMonitoring();
      else resizeStatus();
    }, 100);
    fetchChartData();
  }

  function handleTimeRangeChange() {
    customTimeRange.value = undefined;
    fetchChartData();
  }

  function handleCustomTimeChange() {
    if (customTimeRange.value) {
      timeRange.value = ''; // Clear preset selection
      fetchChartData();
    }
  }

  function handleChartFilterChange() {
    fetchChartData();
  }

  async function fetchChartData() {
    const deviceId = router.currentRoute.value.params.deviceId as string;
    if (!deviceId) return;

    // Determine keys and setOptions function based on active tab
    let keysToFetch: string[] = [];
    let setOptionsFn: Function = () => {};

    if (activeTabKey.value === 'monitoring') {
      if (selectedKeys.value.length === 0) {
        setMonitoringOptions({ series: [] });
        return;
      }
      keysToFetch = selectedKeys.value;
      setOptionsFn = setMonitoringOptions;
    } else {
      keysToFetch = STATUS_KEYS_CONFIG.map((c) => c.key);
      setOptionsFn = setStatusOptions;
    }

    chartLoading.value = true;
    try {
      let startTs: number;
      let endTs: number;
      const now = dayjs().valueOf();

      if (customTimeRange.value && customTimeRange.value.length === 2) {
        startTs = customTimeRange.value[0].valueOf();
        endTs = customTimeRange.value[1].valueOf();
      } else {
        endTs = now;
        if (timeRange.value === '1h') startTs = now - 60 * 60 * 1000;
        else if (timeRange.value === '7d') startTs = now - 7 * 24 * 60 * 60 * 1000;
        else startTs = now - 24 * 60 * 60 * 1000; // Default 24h
      }

      const res = await getTimeseries({
        entityType: EntityType.DEVICE,
        entityId: deviceId,
        keys: keysToFetch.join(','),
        startTs,
        endTs,
        limit: 5000,
        orderBy: 'ASC',
      });

      const dataMap = res as any;

      if (activeTabKey.value === 'monitoring') {
        renderMonitoringChart(dataMap, keysToFetch, setOptionsFn);
      } else {
        renderStatusChart(dataMap, setOptionsFn);
      }
    } catch (e) {
      console.error(e);
    } finally {
      chartLoading.value = false;
    }
  }

  function renderMonitoringChart(dataMap: any, keys: string[], setOptions: Function) {
    const series: any[] = [];
    const yAxis: any[] = [];
    const legendData: string[] = [];

    // Classify keys
    const groups = {
      QJ: [] as string[],
      LF: [] as string[],
      JS: [] as string[],
      Other: [] as string[],
    };

    keys.forEach((key) => {
      if (key.includes('QJ')) groups.QJ.push(key);
      else if (key.includes('LF')) groups.LF.push(key);
      else if (key.includes('JS')) groups.JS.push(key);
      else groups.Other.push(key);
    });

    let yAxisIndexCounter = 0;

    // 1. QJ
    if (groups.QJ.length > 0) {
      yAxis.push({
        type: 'value',
        name: 'QJ',
        position: 'left',
        axisLine: { show: true },
        max: 'dataMax',
        min: 'dataMin',
      });
      groups.QJ.forEach((key) => {
        const val = dataMap[key];
        const dataPoints = Array.isArray(val) ? val : val?.data || [];
        series.push({
          name: key,
          type: 'line',
          symbol: 'circle',
          showSymbol: false,
          yAxisIndex: yAxisIndexCounter,
          data: dataPoints.map((pt: any) => [pt.ts, pt.value]),
        });
        legendData.push(key);
      });
      yAxisIndexCounter++;
    }

    // 2. LF
    if (groups.LF.length > 0) {
      yAxis.push({
        type: 'value',
        name: 'LF',
        position: 'right',
        offset: 0,
        axisLine: { show: true },
        max: 'dataMax',
        min: 'dataMin',
        splitLine: { show: false },
      });
      groups.LF.forEach((key) => {
        const val = dataMap[key];
        const dataPoints = Array.isArray(val) ? val : val?.data || [];
        series.push({
          name: key,
          type: 'line',
          symbol: 'rect',
          showSymbol: false,
          yAxisIndex: yAxisIndexCounter,
          data: dataPoints.map((pt: any) => [pt.ts, pt.value]),
        });
        legendData.push(key);
      });
      yAxisIndexCounter++;
    }

    // 3. JS
    if (groups.JS.length > 0) {
      yAxis.push({
        type: 'value',
        name: 'JS',
        position: 'right',
        offset: groups.LF.length > 0 ? 50 : 0,
        axisLine: { show: true },
        splitLine: { show: false },
      });
      groups.JS.forEach((key) => {
        const val = dataMap[key];
        const dataPoints = Array.isArray(val) ? val : val?.data || [];
        series.push({
          name: key,
          type: 'bar',
          yAxisIndex: yAxisIndexCounter,
          data: dataPoints.map((pt: any) => [pt.ts, pt.value]),
        });
        legendData.push(key);
      });
      yAxisIndexCounter++;
    }

    // 4. Other (Default)
    if (groups.Other.length > 0) {
      if (yAxis.length === 0) {
        yAxis.push({ type: 'value', position: 'left' });
        yAxisIndexCounter++;
      }

      groups.Other.forEach((key) => {
        const val = dataMap[key];
        const dataPoints = Array.isArray(val) ? val : val?.data || [];
        series.push({
          name: key,
          type: 'line',
          yAxisIndex: 0, // Default to first axis
          showSymbol: false,
          data: dataPoints.map((pt: any) => [pt.ts, pt.value]),
        });
        legendData.push(key);
      });
    }

    setOptions({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: legendData,
      },
      grid: {
        left: '3%',
        right: groups.JS.length > 0 && groups.LF.length > 0 ? '15%' : '8%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false as any,
      },
      yAxis: yAxis,
      series: series,
    });
  }

  function renderStatusChart(dataMap: any, setOptions: Function) {
    const series: any[] = [];
    const yAxis: any[] = [];
    const legendData: string[] = [];

    // Define Axes: Temp (Left), Volt (Right), Humidity (Right Offset)
    // 0: Temp
    yAxis.push({
      type: 'value',
      name: '温度(°C)',
      position: 'left',
      axisLine: { show: true },
    });
    // 1: Volt
    yAxis.push({
      type: 'value',
      name: '电压(V)',
      position: 'right',
      axisLine: { show: true },
      splitLine: { show: false },
    });
    // 2: Humidity
    yAxis.push({
      type: 'value',
      name: '湿度(%)',
      position: 'right',
      offset: 50,
      axisLine: { show: true },
      splitLine: { show: false },
      max: 100,
      min: 0,
    });

    STATUS_KEYS_CONFIG.forEach((config) => {
      const val = dataMap[config.key];
      const dataPoints = Array.isArray(val) ? val : val?.data || [];
      if (dataPoints.length === 0) return;

      let yAxisIndex = 0;
      if (config.axis === 'volt') yAxisIndex = 1;
      if (config.axis === 'humidity') yAxisIndex = 2;

      series.push({
        name: config.alias,
        type: 'line',
        showSymbol: false,
        yAxisIndex: yAxisIndex,
        data: dataPoints.map((pt: any) => [pt.ts, pt.value]),
      });
      legendData.push(config.alias);
    });

    setOptions({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: legendData,
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false as any,
      },
      yAxis: yAxis,
      series: series,
    });
  }

  function mapEntityRow(row: any) {
    const latest = row.latest || {};
    const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
    const entity: any = {
      entityId: row.entityId,
      name: get('ENTITY_FIELD', 'name'),
      type: get('ENTITY_FIELD', 'type'),
      label: get('ENTITY_FIELD', 'label'),
      createdTime: get('ENTITY_FIELD', 'createdTime'),
      active: get('ATTRIBUTE', 'active') === true || get('ATTRIBUTE', 'active') === 'true',
      lastActivityTime: get('ATTRIBUTE', 'lastActivityTime'),
    };
    DEVICE_FIELDS.fields.forEach((f) => {
      if (!['name', 'type', 'label', 'active', 'lastActivityTime'].includes(f.key)) {
        entity[f.key] = get('SERVER_ATTRIBUTE', f.key);
      }
    });
    return entity;
  }

  function getFieldAlias(key: string) {
    const f = DEVICE_FIELDS.fields.find((x) => x.key === key);
    return f?.alias || key;
  }
  function groupOrder(groupKey: string) {
    return DEVICE_FIELDS.groups[groupKey]?.order || [];
  }
  function displayValue(val: any) {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number' && String(val).length >= 12) return dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss');
    return val;
  }
  function openMap(lon?: any, lat?: any) {
    if (!lon || !lat) return;
    router.push({ path: '/portal/map', query: { center: `${lon},${lat}`, entityType: 'DEVICE' } });
  }

  async function goRelatedAssets() {
    const id = detail.value?.entityId?.id;
    if (!id) return;
    try {
      const list = await findRelationListByToAndType({
        toId: id,
        toType: EntityType.DEVICE,
        relationType: 'Contains',
        relationTypeGroup: 'COMMON',
      });
      const assetId = list?.[0]?.from?.id;
      if (assetId) {
        router.push({ path: `/portal/assets/${assetId}` });
        return;
      }
    } catch (e) {}
    router.push({
      path: '/portal/assets',
      query: { rootType: 'DEVICE', rootId: id, direction: 'TO', relationType: 'Contains' },
    });
  }
</script>
