<template>
  <PageWrapper :title="t('routes.portal.map')">
    <div class="flex items-center gap-3 mb-3">
      <a-select v-model:value="entityType" style="width: 160px" @change="reload">
        <a-select-option value="DEVICE">设备</a-select-option>
        <a-select-option value="ASSET">资产</a-select-option>
      </a-select>
      <a-button type="primary" @click="reload">刷新</a-button>
    </div>
    <div id="portal-bmap" style="height: 560px; width: 100%"></div>
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalMapPage',
  };
</script>
<script lang="ts" setup>
  import { ref, watchEffect, onMounted } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { useBMap } from '/@/hooks/web/useBMap';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import dayjs from 'dayjs';
  import { router } from '/@/router';

  const { t } = useI18n();

  const entityType = ref<'DEVICE' | 'ASSET'>(((router.currentRoute.value.query.entityType as any) || 'DEVICE') as any);

  const { success, BMapGL } = useBMap(import.meta.env.VITE_BAIDU_MAP_AK || '');
  let mapInstance: any = undefined;

  watchEffect(() => {
    if (success.value) {
      initMap();
      reload();
    }
  });

  function initMap() {
    const centerQuery = router.currentRoute.value.query.center as string | undefined;
    let center: any = '诸城市';
    if (centerQuery) {
      const [lon, lat] = centerQuery.split(',').map((x) => Number(x));
      center = new BMapGL.value.Point(lon, lat);
    }
    mapInstance = new BMapGL.value.Map('portal-bmap', { enableRotate: false, enableTilt: false });
    mapInstance.centerAndZoom(center, 10);
    mapInstance.enableScrollWheelZoom(true);
  }

  async function reload() {
    if (!mapInstance || !BMapGL.value) return;
    mapInstance.clearOverlays();

    if (entityType.value === 'DEVICE') {
      await loadDevices();
    } else {
      await loadAssets();
    }
  }

  async function loadDevices() {
    const serverAttrKeys = ['Longitude', 'Latitude', 'active', 'lastActivityTime'];
    const page = await findEntityDataByQuery({
      entityFilter: { type: 'entityType', entityType: EntityType.DEVICE },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'label' },
      ],
      pageLink: { page: 0, pageSize: 200 },
      latestValues: [
        ...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k })),
      ],
    });
    const list = page.data.map((row: any) => {
      const latest = row.latest || {};
      const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
      return {
        name: get('ENTITY_FIELD', 'name'),
        label: get('ENTITY_FIELD', 'label'),
        active: get('SERVER_ATTRIBUTE', 'active') === true || get('SERVER_ATTRIBUTE', 'active') === 'true',
        lastActivityTime: Number(get('SERVER_ATTRIBUTE', 'lastActivityTime')),
        longitude: Number(get('SERVER_ATTRIBUTE', 'Longitude')),
        latitude: Number(get('SERVER_ATTRIBUTE', 'Latitude')),
      };
    }).filter((x: any) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude));
    renderMarkers(list);
  }

  async function loadAssets() {
    const serverAttrKeys = ['经度', '纬度'];
    const page = await findEntityDataByQuery({
      entityFilter: { type: 'entityType', entityType: EntityType.ASSET },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'label' },
      ],
      pageLink: { page: 0, pageSize: 200 },
      latestValues: [
        ...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k })),
      ],
    });
    const list = page.data.map((row: any) => {
      const latest = row.latest || {};
      const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
      return {
        name: get('ENTITY_FIELD', 'name'),
        label: get('ENTITY_FIELD', 'label'),
        longitude: Number(get('SERVER_ATTRIBUTE', '经度')),
        latitude: Number(get('SERVER_ATTRIBUTE', '纬度')),
        active: undefined,
        lastActivityTime: undefined,
      };
    }).filter((x: any) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude));
    renderMarkers(list);
  }

  function renderMarkers(list: Array<any>) {
    list.forEach((item) => {
      const point = new BMapGL.value.Point(item.longitude, item.latitude);
      const marker = new BMapGL.value.Marker(point);
      mapInstance.addOverlay(marker);
      const info =
        `<div style="display:flex;justify-content:space-between;margin:0 6px 0 1px"><strong>名称：</strong><span>${item.name || ''}</span></div>` +
        `<div style="display:flex;justify-content:space-between;margin:0 6px 0 1px"><strong>标签：</strong><span>${item.label || ''}</span></div>` +
        (item.active !== undefined
          ? `<div style="display:flex;justify-content:space-between;margin:0 6px 0 1px"><strong>状态：</strong><span style="color:${item.active ? 'green' : 'red'}">${item.active ? '在线' : '离线'}</span></div>`
          : '') +
        (item.lastActivityTime
          ? `<div style="display:flex;justify-content:space-between;margin:0 6px 0 1px"><strong>活动时间：</strong><span>${dayjs(item.lastActivityTime).format('YYYY-MM-DD HH:mm:ss')}</span></div>`
          : '');
      const infoWindow = new BMapGL.value.InfoWindow(info, { width: 240, height: 130, title: `<strong>${item.name || ''}</strong>` });
      marker.addEventListener('click', function () {
        mapInstance.openInfoWindow(infoWindow, point);
      });
    });
  }

  onMounted(() => {
    // noop, map will init in watchEffect
  });
</script>