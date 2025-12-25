<template>
  <PageWrapper :title="t('routes.portal.assetDetail')">
    <div class="space-y-6">
      <div class="flex gap-2">
        <a-button type="primary" @click="goRelatedDevices">查看关联设备列表</a-button>
      </div>
      <a-card :title="t('routes.portal.assets')">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('basic')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.site.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('site')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.hazard.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('hazard')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.construction.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('construction')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.geo.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="alias('经度')">
            <a @click="openMap(detail['经度'], detail['纬度'])">{{ displayValue(detail['经度']) }}</a>
          </a-descriptions-item>
          <a-descriptions-item :label="alias('纬度')">
            <a @click="openMap(detail['经度'], detail['纬度'])">{{ displayValue(detail['纬度']) }}</a>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card title="地灾点位置与设备分布">
        <div class="relative" style="height: 420px; width: 100%">
          <div id="asset-tdt-map" style="height: 100%; width: 100%"></div>
          <div class="absolute right-2 top-2 bg-white/80 rounded shadow px-1 py-1 flex gap-1" style="z-index: 9999">
            <a-button size="small" :type="baseType === 'vec' ? 'primary' : 'default'" @click="applyBaseType('vec')"
              >矢量</a-button
            >
            <a-button size="small" :type="baseType === 'sat' ? 'primary' : 'default'" @click="applyBaseType('sat')"
              >影像</a-button
            >
            <a-button
              size="small"
              :type="baseType === 'hybrid' ? 'primary' : 'default'"
              @click="applyBaseType('hybrid')"
              >卫星混合</a-button
            >
          </div>
          <div v-if="tdtError" class="absolute inset-0 flex items-center justify-center">
            <div class="text-center space-y-3">
              <div>天地图加载失败</div>
              <a-button type="primary" @click="retryTianditu">重试</a-button>
            </div>
          </div>
          <div
            v-if="mouseCoordText"
            class="absolute right-2 bottom-2 px-2 py-1 bg-white/80 rounded shadow text-xs"
            style="z-index: 9999; pointer-events: none"
          >
            {{ mouseCoordText }}
          </div>
        </div>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.stats.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('stats')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="ASSET_FIELDS.groups.extra.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('extra')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card title="关联设备">
        <BasicTable @register="registerRelatedTable">
          <template #tableTitle>
            <div class="space-x-2">
              <a-button type="primary" @click="exportRelatedDevices">
                <Icon icon="ant-design:file-excel-outlined" /> 导出
              </a-button>
            </div>
          </template>
        </BasicTable>
      </a-card>

      <a-card :loading="false" :bordered="false">
        <BasicTable @register="registerAlarmTable" :title="t('portal.devices.detail.alarmList')">
          <template #toolbar>
            <div class="flex items-center">
              <span class="mr-2">{{ t('portal.devices.detail.alarmStatus') }}:</span>
              <Radio.Group v-model:value="alarmStatus" button-style="solid" @change="handleAlarmStatusChange">
                <Radio.Button value="ACTIVE">{{ t('portal.devices.detail.alarm.active') }}</Radio.Button>
                <Radio.Button value="CLEARED">{{ t('portal.devices.detail.alarm.cleared') }}</Radio.Button>
                <Radio.Button value="ACK">{{ t('portal.devices.detail.alarm.ack') }}</Radio.Button>
                <Radio.Button value="ANY">{{ t('portal.devices.detail.alarm.all') }}</Radio.Button>
              </Radio.Group>
            </div>
          </template>
          <template #action="{ record }">
            <TableAction
              :actions="[
                {
                  label: '详情',
                  onClick: openAlarmDetail.bind(null, record),
                },
              ]"
            />
          </template>
        </BasicTable>
      </a-card>
    </div>
    <AlarmDetailDrawer @register="registerDrawer" @success="handleAlarmActionSuccess" />
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalAssetDetailPage',
  };
</script>
<script lang="ts" setup>
  import { ref, onMounted, watchEffect, h } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { findEntityDataByQuery, findAlarmDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { router } from '/@/router';
  import { useTabs } from '/@/hooks/web/useTabs';
  import dayjs from 'dayjs';
  import { ASSET_FIELDS } from '/@/views/portal/config/attributes';
  import { BasicTable, useTable, BasicColumn, TableAction } from '/@/components/Table';
  import { Icon } from '/@/components/Icon';
  import { jsonToSheetXlsx } from '/@/components/Excel/src/Export2Excel';
  import { useTianditu } from '/@/hooks/web/useTianditu';
  import { Radio, Tag } from 'ant-design-vue';
  import { getAlarmInfoByEntity } from '/@/api/tb/alarm';
  import { AlarmSeverity } from '/@/enums/alarmEnum';
  import { useDrawer } from '/@/components/Drawer';
  import AlarmDetailDrawer from '/@/views/tdiot/alerts/detail.vue';

  const { t } = useI18n();
  const detail = ref<any>({});
  const allDevices = ref<any[]>([]);
  const { setTitle } = useTabs();
  const { success: tdtReady, error: tdtErrorRef, T } = useTianditu(import.meta.env.VITE_TIANDITU_TK || '');
  let tdtMap: any = undefined;
  const mouseCoordText = ref('');
  const tdtError = ref(false);
  const baseType = ref<'sat' | 'hybrid' | 'vec'>('sat');

  onMounted(async () => {
    const assetId = router.currentRoute.value.params.assetId as string;
    const page = await findEntityDataByQuery({
      entityFilter: {
        type: 'singleEntity',
        singleEntity: { id: assetId, entityType: EntityType.ASSET },
      },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      latestValues: [
        ...ASSET_FIELDS.fields
          .filter((f) => !['name', 'type', 'label'].includes(f.key))
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

    await reloadRelated();
    await fetchAllRelatedDevices();

    if (tdtMap) {
      renderDeviceMarkers();
    }
  });

  watchEffect(() => {
    tdtError.value = tdtErrorRef.value === true;
    if (tdtReady.value && !tdtMap) {
      initTianditu();
      renderDeviceMarkers();
    }
  });

  function mapEntityRow(row: any) {
    const latest = row.latest || {};
    const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
    const entity: any = {
      entityId: row.entityId,
      name: get('ENTITY_FIELD', 'name'),
      type: get('ENTITY_FIELD', 'type'),
      label: get('ENTITY_FIELD', 'label'),
      createdTime: get('ENTITY_FIELD', 'createdTime'),
    };
    ASSET_FIELDS.fields.forEach((f) => {
      if (!['name', 'type', 'label'].includes(f.key)) {
        entity[f.key] = get('SERVER_ATTRIBUTE', f.key);
      }
    });
    return entity;
  }

  function alias(key: string) {
    const f = ASSET_FIELDS.fields.find((x) => x.key === key);
    return f?.alias || key;
  }
  function groupOrder(groupKey: string) {
    return ASSET_FIELDS.groups[groupKey]?.order || [];
  }
  function displayValue(val: any) {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number' && String(val).length >= 12) return dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss');
    return val;
  }
  function openMap(lon?: any, lat?: any) {
    if (!lon || !lat) return;
    router.push({ path: '/portal/map', query: { center: `${lon},${lat}`, entityType: 'ASSET' } });
  }

  function goRelatedDevices() {
    const id = detail.value?.entityId?.id;
    if (id) {
      router.push({
        path: '/portal/devices',
        query: { rootType: 'ASSET', rootId: id, direction: 'FROM', relationType: 'Contains' },
      });
    }
  }

  const relatedColumns: BasicColumn[] = [
    { title: '名称', dataIndex: 'name', key: 'name', align: 'left' },
    { title: '设备编号', dataIndex: 'DeviceNo', key: 'DeviceNo', align: 'left' },
    { title: 'MQTT客户端ID', dataIndex: 'MQTT_CLIENT_ID', key: 'MQTT_CLIENT_ID', align: 'left' },
    { title: '设备名称', dataIndex: 'DeviceName', key: 'DeviceName', align: 'left' },
    { title: '设备类型', dataIndex: 'DeviceType', key: 'DeviceType', align: 'left' },
    { title: '监测类型', dataIndex: '监测类型', key: '监测类型', align: 'left' },
    { title: '经度', dataIndex: 'Longitude', key: 'Longitude', align: 'left' },
    { title: '纬度', dataIndex: 'Latitude', key: 'Latitude', align: 'left' },
  ];

  const relatedActionColumn: BasicColumn = {
    width: 160,
    actions: (record: any) => [
      {
        icon: 'ant-design:eye-outlined',
        title: '查看详情',
        onClick: () => router.push(`/portal/devices/${record.entityId.id}`),
      },
    ],
  };

  const [registerRelatedTable, { reload: reloadRelated, getDataSource }] = useTable({
    rowKey: (record) => record.entityId?.id,
    api: fetchRelatedDevices,
    columns: relatedColumns,
    actionColumn: relatedActionColumn,
    showTableSetting: true,
    useSearchForm: false,
    canResize: true,
    clickToRowSelect: false,
    defSort: { sortProperty: 'createdTime', sortOrder: 'DESC' },
  });

  async function fetchRelatedDevices(param: any) {
    const assetId = router.currentRoute.value.params.assetId as string;
    const serverAttrKeys = [
      'DeviceNo',
      'MQTT_CLIENT_ID',
      'DeviceName',
      'Longitude',
      'Latitude',
      'DeviceType',
      '监测类型',
    ];
    const query = {
      entityFilter: {
        type: 'relationsQuery',
        rootEntity: { id: assetId, entityType: EntityType.ASSET },
        direction: 'FROM',
        maxLevel: 1,
        fetchLastLevelOnly: true,
        filters: [{ relationType: 'Contains', entityTypes: [EntityType.DEVICE], negate: false }],
      },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      pageLink: {
        page: param.page,
        pageSize: param.pageSize,
        textSearch: null,
        sortOrder: {
          direction: param.sortOrder || 'DESC',
          key: { type: 'ENTITY_FIELD', key: param.sortProperty || 'createdTime' },
        },
      },
      latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
    };
    const page = await findEntityDataByQuery(query);
    const mapped = page.data.map((row: any) => mapDeviceRow(row));
    return { ...page, data: mapped };
  }

  async function fetchAllRelatedDevices() {
    const assetId = router.currentRoute.value.params.assetId as string;
    const serverAttrKeys = [
      'DeviceNo',
      'MQTT_CLIENT_ID',
      'DeviceName',
      'Longitude',
      'Latitude',
      'DeviceType',
      '监测类型',
    ];
    const query = {
      entityFilter: {
        type: 'relationsQuery',
        rootEntity: { id: assetId, entityType: EntityType.ASSET },
        direction: 'FROM',
        maxLevel: 1,
        fetchLastLevelOnly: true,
        filters: [{ relationType: 'Contains', entityTypes: [EntityType.DEVICE], negate: false }],
      },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      pageLink: {
        page: 0,
        pageSize: 1000,
        textSearch: null,
        sortOrder: {
          direction: 'DESC',
          key: { type: 'ENTITY_FIELD', key: 'createdTime' },
        },
      },
      latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
    };
    try {
      const page = await findEntityDataByQuery(query);
      allDevices.value = page.data.map((row: any) => mapDeviceRow(row));
    } catch (e) {
      console.error(e);
      allDevices.value = [];
    }
  }

  function mapDeviceRow(row: any) {
    const latest = row.latest || {};
    const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
    const entity: any = {
      entityId: row.entityId,
      name: get('ENTITY_FIELD', 'name'),
      DeviceNo: get('SERVER_ATTRIBUTE', 'DeviceNo'),
      MQTT_CLIENT_ID: get('SERVER_ATTRIBUTE', 'MQTT_CLIENT_ID'),
      DeviceName: get('SERVER_ATTRIBUTE', 'DeviceName'),
      DeviceType: get('SERVER_ATTRIBUTE', 'DeviceType'),
      监测类型: get('SERVER_ATTRIBUTE', '监测类型'),
      Longitude: get('SERVER_ATTRIBUTE', 'Longitude'),
      Latitude: get('SERVER_ATTRIBUTE', 'Latitude'),
    };
    return entity;
  }

  function exportRelatedDevices() {
    const data = getDataSource();
    jsonToSheetXlsx({
      data,
      header: {
        name: '名称',
        DeviceNo: '设备编号',
        MQTT_CLIENT_ID: 'MQTT客户端ID',
        DeviceName: '设备名称',
        Longitude: '经度',
        Latitude: '纬度',
      },
      filename: '关联设备列表.xlsx',
    });
  }

  function initTianditu() {
    if (!T.value) return;
    // EPSG:4490（CGCS2000）与 EPSG:4326 坐标系一致使用经纬度度单位
    tdtMap = new T.value.Map('asset-tdt-map', { minZoom: 3, maxZoom: 22, projection: 'EPSG:4326' });
    tdtMap.enableScrollWheelZoom();
    tdtMap.addControl(new T.value.Control.Scale());
    tdtMap.addControl(new T.value.Control.Zoom());
    tdtMap.addEventListener('mousemove', function (e: any) {
      const lng = Number(e.lnglat?.lng)?.toFixed(6);
      const lat = Number(e.lnglat?.lat)?.toFixed(6);
      mouseCoordText.value = `经度: ${lng}, 纬度: ${lat}`;
    });
    applyBaseType(baseType.value);
    const lon = Number(detail.value['经度']);
    const lat = Number(detail.value['纬度']);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      tdtMap.centerAndZoom(new T.value.LngLat(lon, lat), 18);
    }
  }

  function renderDeviceMarkers() {
    if (!tdtMap || !T.value) return;
    tdtMap.clearOverLays();
    const list = (allDevices.value || []) as Array<any>;
    const points: any[] = [];
    list
      .map((row: any) => ({
        entityId: row.entityId,
        name: row.name || row.DeviceName,
        typename: row.DeviceType || row['设备名称'] || '',
        lon: Number(row.Longitude),
        lat: Number(row.Latitude),
      }))
      .filter((x) => Number.isFinite(x.lon) && Number.isFinite(x.lat))
      .forEach((item) => {
        const pt = new T.value.LngLat(item.lon, item.lat);
        points.push(pt);
        const color = stringToColor(item.typename || '默认');

        const CircleMarker = T.value.Overlay.extend({
          initialize: function (lnglat: any, options: any) {
            this.lnglat = lnglat;
            this.options = options || {};
            this._clickCallback = null;
          },
          onAdd: function (map: any) {
            this.map = map;
            const container = (this._div = document.createElement('div'));
            container.style.position = 'absolute';
            container.style.zIndex = '1000';
            container.style.transform = 'translate3d(-50%, -50%, 0)';
            container.style.cursor = 'pointer';

            // Dot
            const dot = document.createElement('div');
            dot.style.width = '16px';
            dot.style.height = '16px';
            dot.style.borderRadius = '8px';
            dot.style.background = this.options.color || '#1e90ff';
            dot.style.border = '2px solid #fff';
            dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';
            dot.title = this.options.name || '';
            dot.setAttribute('role', 'button');
            container.appendChild(dot);

            // Label (默认显示)
            const label = document.createElement('div');
            label.className = 'device-label';
            label.style.position = 'absolute';
            label.style.top = '18px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.background = 'rgba(255,255,255,0.8)';
            label.style.padding = '2px 4px';
            label.style.borderRadius = '2px';
            label.style.fontSize = '12px';
            label.style.whiteSpace = 'nowrap';
            label.style.pointerEvents = 'none';
            label.style.display = 'block'; // 默认显示
            label.innerText = this.options.name || '';
            this._labelDiv = label;
            container.appendChild(label);

            // Bind click event if callback exists
            if (this._clickCallback) {
              container.addEventListener('click', this._clickCallback);
            }

            map.getPanes().overlayPane.appendChild(container);
            this.update();
            return container;
          },
          onRemove: function () {
            const parent = this._div?.parentNode;
            if (parent) parent.removeChild(this._div);
            this._div = null;
            this._labelDiv = null;
            this.map = null;
          },
          update: function () {
            if (!this.map || !this._div) return;
            const pos = this.map.lngLatToLayerPoint(this.lnglat);
            this._div.style.top = pos.y + 'px';
            this._div.style.left = pos.x + 'px';
          },
          getLngLat: function () {
            return this.lnglat;
          },
          addEventListener: function (type: string, callback: Function) {
            if (type === 'click' && typeof callback === 'function') {
              this._clickCallback = callback;
              // If already added to map, bind immediately
              if (this._div) {
                this._div.addEventListener('click', callback);
              }
            }
          },
          openInfoWindow: function (infoWindow: any) {
            this.map.openInfoWindow(infoWindow, this.lnglat);
          },
        });

        const marker = new CircleMarker(pt, { color, name: item.name });
        const infoHtml =
          `<div style="font-size:12px;line-height:1.6">` +
          `<div><strong>名称：</strong><span>${item.name || ''}</span></div>` +
          `<div><strong>类型：</strong><span>${item.typename || ''}</span></div>` +
          `<div><strong>坐标：</strong><span>${item.lon.toFixed(6)}, ${item.lat.toFixed(6)}</span></div>` +
          (item.entityId?.id
            ? `<div style="margin-top:6px"><a href="javascript:void(0)" onclick="window.__openDeviceDetail('${item.entityId.id}')">查看设备详情</a></div>`
            : '') +
          `</div>`;
        const infoWindow = new T.value.InfoWindow(infoHtml, { autoPan: true });
        marker.addEventListener('click', function () {
          marker.openInfoWindow(infoWindow);
        });
        tdtMap.addOverLay(marker);
      });

    if (points.length === 0) {
      // Optional: if no devices, maybe center on asset (already done in initTianditu)
    }

    (window as any).__openDeviceDetail = (id: string) => router.push(`/portal/devices/${id}`);
  }

  function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h},70%,50%)`;
  }

  function buildCircleSvgIcon(color: string, radius: number) {
    const size = radius * 2;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><circle cx='${radius}' cy='${radius}' r='${radius}' fill='${color}' stroke='white' stroke-width='2'/></svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  function retryTianditu() {
    const tk = import.meta.env.VITE_TIANDITU_TK || '';
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${tk}&_=${Date.now()}`;
    script.onload = () => {
      tdtError.value = false;
      if (!tdtMap) initTianditu();
      renderDeviceMarkers();
    };
    script.onerror = () => {
      tdtError.value = true;
    };
    document.head.appendChild(script);
  }

  function applyBaseType(type: 'sat' | 'hybrid' | 'vec') {
    baseType.value = type;
    if (!tdtMap) return;
    if (type === 'sat') {
      tdtMap.setMapType((window as any).TMAP_SATELLITE_MAP);
    } else if (type === 'hybrid') {
      tdtMap.setMapType((window as any).TMAP_HYBRID_MAP);
    } else if (type === 'vec') {
      tdtMap.setMapType((window as any).TMAP_NORMAL_MAP);
    }
  }

  // Alarm Logic
  const alarmStatus = ref('ACTIVE');
  const [registerDrawer, { openDrawer }] = useDrawer();

  const [registerAlarmTable, { reload: reloadAlarms }] = useTable({
    api: fetchAlarms,
    columns: getAlarmColumns(),
    useSearchForm: false,
    showTableSetting: false,
    bordered: true,
    showIndexColumn: false,
    pagination: { pageSize: 10 },
    canResize: false,
    rowKey: (record) => record.id.id,
    fetchSetting: {
      pageField: 'page',
      sizeField: 'pageSize',
      listField: 'items',
      totalField: 'total',
    },
    actionColumn: {
      width: 100,
      title: t('common.action'),
      dataIndex: 'action',
      slots: { customRender: 'action' },
    },
  });

  function handleAlarmStatusChange() {
    reloadAlarms({ page: 1 });
  }

  function openAlarmDetail(record: any) {
    openDrawer(true, record);
  }

  function handleAlarmActionSuccess() {
    reloadAlarms();
  }

  function getAlarmColumns(): BasicColumn[] {
    return [
      {
        title: '严重程度',
        dataIndex: 'severity',
        width: 100,
        customRender: ({ record }) => {
          const color = getSeverityColor(record.severity);
          return h(Tag, { color }, () => record.severity);
        },
      },
      { title: '名称', dataIndex: 'name', width: 200 },
      { title: '来源', dataIndex: 'originatorName', width: 150 },
      {
        title: '时间',
        dataIndex: 'createdTime',
        width: 180,
        format: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      { title: '状态', dataIndex: 'status', width: 120 },
    ];
  }

  function getSeverityColor(severity: AlarmSeverity) {
    switch (severity) {
      case AlarmSeverity.CRITICAL:
        return 'red';
      case AlarmSeverity.MAJOR:
        return 'orange';
      case AlarmSeverity.MINOR:
        return 'gold';
      case AlarmSeverity.WARNING:
        return 'blue';
      case AlarmSeverity.INDETERMINATE:
        return 'purple';
      default:
        return 'default';
    }
  }

  async function fetchAlarms(params: any) {
    const assetId = router.currentRoute.value.params.assetId as string;
    if (!assetId) return { items: [], total: 0 };

    const statusList = alarmStatus.value === 'ANY' ? [] : [alarmStatus.value];

    // Construct AlarmDataQuery
    const query = {
      entityFilter: {
        type: 'relationsQuery',
        rootEntity: { id: assetId, entityType: EntityType.ASSET },
        direction: 'FROM',
        maxLevel: 1,
        fetchLastLevelOnly: true,
        filters: [{ relationType: 'Contains', entityTypes: [EntityType.DEVICE], negate: false }],
      },
      pageLink: {
        page: params.page > 0 ? params.page - 1 : 0,
        pageSize: params.pageSize,
        textSearch: null,
        sortOrder: {
          direction: params.sortOrder || 'DESC',
          key: { type: 'ALARM_FIELD', key: params.sortProperty || 'createdTime' },
        },
        searchPropagatedAlarms: false,
        statusList: statusList,
      },
      alarmFields: [
        { type: 'ALARM_FIELD', key: 'name' },
        { type: 'ALARM_FIELD', key: 'status' },
        { type: 'ALARM_FIELD', key: 'severity' },
        { type: 'ALARM_FIELD', key: 'createdTime' },
        { type: 'ALARM_FIELD', key: 'originatorName' },
      ],
    };

    try {
      const res = await findAlarmDataByQuery(query);
      const items = res.data.map((item: any) => ({
        ...item,
        id: item.id,
        createdTime: item.createdTime,
        name: item.latest?.ALARM_FIELD?.name?.value || item.name || '',
        status: item.latest?.ALARM_FIELD?.status?.value || item.status || '',
        severity: item.latest?.ALARM_FIELD?.severity?.value || item.severity || '',
        originatorName: item.latest?.ALARM_FIELD?.originatorName?.value || item.originatorName || '',
      }));
      return { items: items, total: res.totalElements };
    } catch (error) {
      console.error('fetchAlarms error:', error);
      return { items: [], total: 0 };
    }
  }
</script>
