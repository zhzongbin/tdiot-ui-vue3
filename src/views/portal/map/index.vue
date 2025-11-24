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
  import { EntityKeyType, EntityKeyValueType, FilterPredicateType, NumericOperation } from '/@/enums/queryEnum';
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
  let assetOverlays: any[] = [];
  let deviceOverlays: any[] = [];
  let currentMode: 'ASSET_LOW' | 'DEVICE_HIGH' | null = null;
  let loadToken = 0;
  const zoomThreshold = 14;

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
      mapInstance.centerAndZoom(new T.value.LngLat(118, 26), 7);
    }
    mapInstance.addEventListener('zoomend', function () {
      const zoom = mapInstance.getZoom?.() || 5;
      if (zoom < zoomThreshold) {
        if (currentMode !== 'ASSET_LOW') {
          reload();
        } else {
          updateMarkers(zoom);
        }
      } else {
        if (currentMode !== 'DEVICE_HIGH') {
          reload();
        } else {
          updateMarkers(zoom);
        }
      }
    });
    mapInstance.addEventListener('moveend', function () {
      const zoom = mapInstance.getZoom?.() || 5;
      if (zoom < zoomThreshold) {
        // assetOverlays.forEach((ov: any) => ov.update && ov.update());
        updateMarkers(zoom);
      } else {
        // reload();
        // For devices, we might need to reload if we moved too far, but for now let's just update markers if we are just panning small amounts
        // Actually the original logic reloaded on moveend for devices to fetch new data in viewport. Let's keep that if needed.
        // But if we just want to update labels, we can do that too.
        // Let's stick to original logic: reload for devices (High zoom) to get data in view, update for assets (Low zoom).
        // Wait, original logic:
        // if (zoom < zoomThreshold) { assetOverlays.update... } else { reload() }
        // So for devices it reloads.
        reload();
      }
    });
  }

  function updateMarkers(zoom: number) {
    // Update Assets
    if (currentMode === 'ASSET_LOW') {
      const showLabel = zoom >= 10;
      assetOverlays.forEach((ov: any) => {
        if (ov.updateVisibilty) ov.updateVisibilty(showLabel);
        if (ov.update) ov.update();
      });
    }
    // Update Devices
    if (currentMode === 'DEVICE_HIGH') {
      const showLabel = zoom >= 16;
      deviceOverlays.forEach((ov: any) => {
        if (ov.updateVisibilty) ov.updateVisibilty(showLabel);
        if (ov.update) ov.update();
      });
    }
  }

  async function reload() {
    if (!mapInstance || !T.value) return;
    const overlays = mapInstance.getOverlays?.() || [];
    overlays.forEach((ov: any) => mapInstance.removeOverLay?.(ov));
    activeOverlays = [];
    assetOverlays = [];
    deviceOverlays = [];
    const zoom = mapInstance.getZoom?.() || 5;
    if (zoom < zoomThreshold) {
      currentMode = 'ASSET_LOW';
      await loadAssets(true);
    } else {
      currentMode = 'DEVICE_HIGH';
      await loadDevices(true);
    }
    // Initial update for visibility
    updateMarkers(zoom);
  }

  async function loadDevices(resetToken?: boolean) {
    const serverAttrKeys = ['Longitude', 'Latitude', 'active', 'lastActivityTime', 'DeviceType', '监测类型'];
    const token = resetToken ? ++loadToken : loadToken;
    const bounds = mapInstance.getBounds?.();
    const sw = bounds?.getSouthWest?.();
    const ne = bounds?.getNorthEast?.();
    const minLng = Number(sw?.lng) || -180;
    const minLat = Number(sw?.lat) || -90;
    const maxLng = Number(ne?.lng) || 180;
    const maxLat = Number(ne?.lat) || 90;
    const keyFilters: any[] = [
      {
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: 'Longitude' },
        valueType: EntityKeyValueType.NUMERIC,
        predicate: {
          type: FilterPredicateType.NUMERIC,
          operation: NumericOperation.GREATER_OR_EQUAL,
          value: { defaultValue: minLng },
        },
      },
      {
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: 'Longitude' },
        valueType: EntityKeyValueType.NUMERIC,
        predicate: {
          type: FilterPredicateType.NUMERIC,
          operation: NumericOperation.LESS_OR_EQUAL,
          value: { defaultValue: maxLng },
        },
      },
      {
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: 'Latitude' },
        valueType: EntityKeyValueType.NUMERIC,
        predicate: {
          type: FilterPredicateType.NUMERIC,
          operation: NumericOperation.GREATER_OR_EQUAL,
          value: { defaultValue: minLat },
        },
      },
      {
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: 'Latitude' },
        valueType: EntityKeyValueType.NUMERIC,
        predicate: {
          type: FilterPredicateType.NUMERIC,
          operation: NumericOperation.LESS_OR_EQUAL,
          value: { defaultValue: maxLat },
        },
      },
    ];
    let pageIndex = 0;
    const pageSize = 1000;
    const all: any[] = [];
    for (;;) {
      const page = await findEntityDataByQuery({
        entityFilter: { type: 'entityType', entityType: EntityType.DEVICE },
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
        ],
        pageLink: { page: pageIndex, pageSize },
        latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
        keyFilters,
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
      all.push(...list);
      if (token !== loadToken) return;
      if (!page.hasNext) break;
      pageIndex += 1;
      await new Promise((r) => setTimeout(r, 150));
    }
    renderMarkers(all);
  }

  async function loadAssets(resetToken?: boolean) {
    const serverAttrKeys = ['经度', '纬度', 'Stationname', '监测点名称'];
    const token = resetToken ? ++loadToken : loadToken;
    let pageIndex = 0;
    const pageSize = 1000;
    const all: any[] = [];
    for (;;) {
      const page = await findEntityDataByQuery({
        entityFilter: { type: 'entityType', entityType: EntityType.ASSET },
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
        ],
        pageLink: { page: pageIndex, pageSize },
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
            stationname: get('SERVER_ATTRIBUTE', 'Stationname') || get('SERVER_ATTRIBUTE', '监测点名称'),
          };
        })
        .filter((x: any) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude));
      all.push(...list);
      if (token !== loadToken) return;
      if (!page.hasNext) break;
      pageIndex += 1;
      await new Promise((r) => setTimeout(r, 150));
    }
    renderAssetMarkers(all);
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
        const container = (this._div = document.createElement('div'));
        container.style.position = 'absolute';
        container.style.zIndex = '1000';
        container.style.transform = 'translate3d(-50%, -50%, 0)';

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

        // Label
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
        label.style.display = 'none'; // Hidden by default
        label.innerText = this.options.name || '';
        this._labelDiv = label;
        container.appendChild(label);

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
      updateVisibilty: function (showLabel: boolean) {
        if (this._labelDiv) {
          this._labelDiv.style.display = showLabel ? 'block' : 'none';
        }
      },
      addEventListener: function (type: string, callback: Function) {
        if (this._div) {
          // Bind click to the container or just the dot? Usually the dot is the clickable target.
          // But let's bind to the container for easier hitting.
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
      deviceOverlays.push(marker);
    });

    // if (points.length === 1) {
    //   mapInstance.centerAndZoom(points[0], 16);
    // } else if (points.length > 1) {
    //   mapInstance.setViewport(points);
    // }
  }

  function renderAssetMarkers(list: Array<any>) {
    const points: any[] = [];
    const LabelMarker = T.value.Overlay.extend({
      initialize: function (lnglat: any, options: any) {
        this.lnglat = lnglat;
        this.options = options || {};
      },
      onAdd: function (map: any) {
        this.map = map;
        const container = (this._div = document.createElement('div'));
        container.style.position = 'absolute';
        container.style.transform = 'translate3d(-50%, -50%, 0)';
        container.style.zIndex = '1000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';

        // Dot for asset
        const dot = document.createElement('div');
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '50%';
        dot.style.background = '#fa8c16'; // Orange for assets
        dot.style.border = '2px solid #fff';
        dot.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
        dot.style.marginBottom = '2px';
        container.appendChild(dot);

        // Label
        const label = document.createElement('div');
        label.style.background = 'rgba(255,255,255,0.85)';
        label.style.border = '1px solid #d9d9d9';
        label.style.borderRadius = '4px';
        label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
        label.style.padding = '2px 6px';
        label.style.fontSize = '12px';
        label.style.lineHeight = '18px';
        label.style.color = '#333';
        label.style.whiteSpace = 'nowrap';
        label.innerText = this.options.text || '';
        this._labelDiv = label;
        container.appendChild(label);

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
      updateVisibilty: function (showLabel: boolean) {
        if (this._labelDiv) {
          this._labelDiv.style.display = showLabel ? 'block' : 'none';
        }
      },
    });

    list.forEach((item) => {
      const pt = new T.value.LngLat(item.longitude, item.latitude);
      points.push(pt);
      const marker = new LabelMarker(pt, { text: item.stationname || item.label || item.name || '' });
      mapInstance.addOverLay(marker);
      activeOverlays.push(marker);
      assetOverlays.push(marker);
    });

    // if (points.length === 1) {
    //   mapInstance.centerAndZoom(points[0], 16);
    // } else if (points.length > 1) {
    //   mapInstance.setViewport(points);
    // }
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
