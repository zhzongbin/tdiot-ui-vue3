<template>
  <PageWrapper :title="t('routes.portal.map')">
    <div class="flex items-center gap-3 mb-3">
      <a-select v-model:value="entityType" style="width: 160px" @change="reload">
        <a-select-option value="DEVICE">设备</a-select-option>
        <a-select-option value="ASSET">资产</a-select-option>
      </a-select>
      <a-button type="primary" @click="reload">刷新</a-button>
    </div>
    <div class="relative" style="height: 560px; width: 100%">
      <div id="portal-tdt-map" style="height: 100%; width: 100%"></div>
      <div class="absolute right-2 top-2 bg-white/80 rounded shadow px-1 py-1 flex gap-1" style="z-index: 9999">
        <a-button size="small" :type="baseType === 'vec' ? 'primary' : 'default'" @click="applyBaseType('vec')"
          >矢量</a-button
        >
        <a-button size="small" :type="baseType === 'sat' ? 'primary' : 'default'" @click="applyBaseType('sat')"
          >影像</a-button
        >
        <a-button size="small" :type="baseType === 'hybrid' ? 'primary' : 'default'" @click="applyBaseType('hybrid')"
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
  import { useTianditu } from '/@/hooks/web/useTianditu';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import dayjs from 'dayjs';
  import { router } from '/@/router';

  const { t } = useI18n();

  const entityType = ref<'DEVICE' | 'ASSET'>(((router.currentRoute.value.query.entityType as any) || 'DEVICE') as any);

  const { success, error: tdtErrorRef, T } = useTianditu(import.meta.env.VITE_TIANDITU_TK || '');
  let mapInstance: any = undefined;
  const tdtError = ref(false);
  const baseType = ref<'sat' | 'hybrid' | 'vec'>('sat');
  const mouseCoordText = ref('');
  let activeOverlays: any[] = [];

  watchEffect(() => {
    tdtError.value = tdtErrorRef.value === true;
    if (success.value) {
      initMap();
      reload();
    }
  });

  function initMap() {
    mapInstance = new T.value.Map('portal-tdt-map', { minZoom: 3, maxZoom: 18 });
    applyBaseType(baseType.value);
    mapInstance.enableScrollWheelZoom();
    mapInstance.addControl(new T.value.Control.Scale());
    mapInstance.addControl(new T.value.Control.Zoom());
    mapInstance.addEventListener('mousemove', function (e: any) {
      const lng = Number(e.lnglat?.lng)?.toFixed(6);
      const lat = Number(e.lnglat?.lat)?.toFixed(6);
      mouseCoordText.value = `经度: ${lng}, 纬度: ${lat}`;
    });
    const centerQuery = router.currentRoute.value.query.center as string | undefined;
    if (centerQuery) {
      const [lon, lat] = centerQuery.split(',').map((x) => Number(x));
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        mapInstance.centerAndZoom(new T.value.LngLat(lon, lat), 14);
      }
    } else {
      mapInstance.centerAndZoom(new T.value.LngLat(104.195397, 35.86166), 5);
    }
    mapInstance.addEventListener('zoomend', function () {
      activeOverlays.forEach((ov: any) => ov.update && ov.update());
    });
    mapInstance.addEventListener('moveend', function () {
      activeOverlays.forEach((ov: any) => ov.update && ov.update());
    });
  }

  async function reload() {
    if (!mapInstance || !T.value) return;
    const overlays = mapInstance.getOverlays?.() || [];
    overlays.forEach((ov: any) => mapInstance.removeOverLay?.(ov));
    activeOverlays = [];

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
      latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
    });
    const list = page.data
      .map((row: any) => {
        const latest = row.latest || {};
        const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
        return {
          name: get('ENTITY_FIELD', 'name'),
          label: get('ENTITY_FIELD', 'label'),
          active: get('SERVER_ATTRIBUTE', 'active') === true || get('SERVER_ATTRIBUTE', 'active') === 'true',
          lastActivityTime: Number(get('SERVER_ATTRIBUTE', 'lastActivityTime')),
          longitude: Number(get('SERVER_ATTRIBUTE', 'Longitude')),
          latitude: Number(get('SERVER_ATTRIBUTE', 'Latitude')),
          typename: get('SERVER_ATTRIBUTE', 'DeviceType') || get('SERVER_ATTRIBUTE', '监测类型') || '',
        };
      })
      .filter((x: any) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude));
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
      latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
    });
    const list = page.data
      .map((row: any) => {
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
      })
      .filter((x: any) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude));
    renderMarkers(list);
  }

  function renderMarkers(list: Array<any>) {
    const points: any[] = [];
    const CircleMarker = T.value.Overlay.extend({
      initialize: function (lnglat: any, options: any) {
        this.lnglat = lnglat;
        this.options = options || {};
      },
      onAdd: function (map: any) {
        this.map = map;
        const div = (this._div = document.createElement('div'));
        div.style.position = 'absolute';
        div.style.width = '16px';
        div.style.height = '16px';
        div.style.borderRadius = '8px';
        div.style.transform = 'translate3d(-50%, -50%, 0)';
        div.style.background = this.options.color || '#1e90ff';
        div.style.border = '2px solid #fff';
        div.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';
        div.style.zIndex = '1000';
        div.title = this.options.name || '';
        div.setAttribute('role', 'button');
        map.getPanes().overlayPane.appendChild(div);
        this.update();
        return div;
      },
      onRemove: function () {
        const parent = this._div?.parentNode;
        if (parent) parent.removeChild(this._div);
        this._div = null;
        this.map = null;
      },
      update: function () {
        if (!this.map || !this._div) return;
        const pos = this.map.lngLatToLayerPoint(this.lnglat);
        this._div.style.top = pos.y + 'px';
        this._div.style.left = pos.x + 'px';
      },
      addEventListener: function (type: string, callback: Function) {
        if (this._div) {
          this._div['on' + type] = typeof callback === 'function' ? callback : function () {};
        }
      },
      openInfoWindow: function (infoWindow: any) {
        this.map.openInfoWindow(infoWindow, this.lnglat);
      },
    });

    list.forEach((item) => {
      const pt = new T.value.LngLat(item.longitude, item.latitude);
      points.push(pt);
      const color = stringToColor(item.typename || item.label || '默认');
      const marker = new CircleMarker(pt, { color, name: item.name });
      const infoHtml =
        `<div style="font-size:12px;line-height:1.6">` +
        `<div><strong>名称：</strong><span>${item.name || ''}</span></div>` +
        `<div><strong>标签：</strong><span>${item.label || ''}</span></div>` +
        (item.active !== undefined
          ? `<div><strong>状态：</strong><span style="color:${item.active ? 'green' : 'red'}">${item.active ? '在线' : '离线'}</span></div>`
          : '') +
        (item.lastActivityTime
          ? `<div><strong>活动时间：</strong><span>${dayjs(item.lastActivityTime).format('YYYY-MM-DD HH:mm:ss')}</span></div>`
          : '') +
        `<div><strong>坐标：</strong><span>${item.longitude.toFixed(6)}, ${item.latitude.toFixed(6)}</span></div>` +
        `</div>`;
      const infoWindow = new T.value.InfoWindow(infoHtml, { autoPan: true });
      marker.addEventListener('click', function () {
        marker.openInfoWindow(infoWindow);
      });
      mapInstance.addOverLay(marker);
      activeOverlays.push(marker);
    });

    if (points.length === 1) {
      mapInstance.centerAndZoom(points[0], 16);
    } else if (points.length > 1) {
      mapInstance.setViewport(points);
    }
  }

  function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h},70%,50%)`;
  }

  function retryTianditu() {
    const tk = import.meta.env.VITE_TIANDITU_TK || '';
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${tk}&_=${Date.now()}`;
    script.onload = () => {
      tdtError.value = false;
      if (!mapInstance) initMap();
      reload();
    };
    script.onerror = () => {
      tdtError.value = true;
    };
    document.head.appendChild(script);
  }

  function applyBaseType(type: 'sat' | 'hybrid' | 'vec') {
    baseType.value = type;
    if (!mapInstance) return;
    if (type === 'sat') {
      mapInstance.setMapType((window as any).TMAP_SATELLITE_MAP);
    } else if (type === 'hybrid') {
      mapInstance.setMapType((window as any).TMAP_HYBRID_MAP);
    } else if (type === 'vec') {
      mapInstance.setMapType((window as any).TMAP_NORMAL_MAP);
    }
  }

  onMounted(() => {});
</script>
