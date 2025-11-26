<template>
  <PageWrapper :title="t('routes.portal.map')">
    <div class="relative" style="height: 560px; width: 100%">
      <div id="portal-tdt-map" style="height: 100%; width: 100%"></div>
      <!-- Top Right Search -->
      <div class="absolute right-2 top-2 bg-white/90 rounded shadow p-1" style="z-index: 9999; width: 300px">
        <AutoComplete
          v-model:value="searchText"
          style="width: 100%"
          :options="searchOptions"
          :filter-option="false"
          :default-active-first-option="false"
          @select="onSelect"
        >
          <template #option="{ label, desc, type }">
            <div class="flex flex-col">
              <div class="flex items-center gap-1">
                <span
                  class="text-xs px-1 rounded text-white"
                  :class="type === 'DEVICE' ? 'bg-blue-500' : 'bg-orange-500'"
                >
                  {{ type === 'DEVICE' ? '设备' : '监测点' }}
                </span>
                <span class="font-bold">{{ label }}</span>
              </div>
              <div class="text-xs text-gray-500 truncate">{{ desc }}</div>
            </div>
          </template>
          <Input v-model:value="searchText" placeholder="搜索设备或监测点(回车搜索)" @pressEnter="onInputEnter">
            <template #suffix>
              <Icon
                v-if="!searchLoading"
                icon="ant-design:search-outlined"
                class="cursor-pointer text-gray-400 hover:text-blue-500"
                @click="handleSearch(searchText)"
              />
              <Icon v-else icon="ant-design:loading-outlined" class="animate-spin text-blue-500" />
            </template>
          </Input>
        </AutoComplete>
      </div>

      <!-- Bottom Left Map Type -->
      <div class="absolute left-2 bottom-2" style="z-index: 9999">
        <Popover placement="topLeft" trigger="click">
          <template #content>
            <div class="flex flex-col gap-1 min-w-[100px]">
              <div
                class="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded flex items-center justify-between"
                :class="{ 'text-blue-600 font-bold': baseType === 'vec' }"
                @click="applyBaseType('vec')"
              >
                <span>矢量地图</span>
                <Icon v-if="baseType === 'vec'" icon="ant-design:check-outlined" />
              </div>
              <div
                class="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded flex items-center justify-between"
                :class="{ 'text-blue-600 font-bold': baseType === 'sat' }"
                @click="applyBaseType('sat')"
              >
                <span>影像地图</span>
                <Icon v-if="baseType === 'sat'" icon="ant-design:check-outlined" />
              </div>
              <div
                class="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded flex items-center justify-between"
                :class="{ 'text-blue-600 font-bold': baseType === 'hybrid' }"
                @click="applyBaseType('hybrid')"
              >
                <span>混合地图</span>
                <Icon v-if="baseType === 'hybrid'" icon="ant-design:check-outlined" />
              </div>
            </div>
          </template>
          <div
            class="bg-white/90 rounded shadow p-2 cursor-pointer hover:bg-gray-50 flex items-center justify-center"
            title="切换地图底图"
          >
            <Icon icon="ion:layers-outline" size="24" />
          </div>
        </Popover>
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
  import { ref, watchEffect, onMounted, unref, watch } from 'vue';
  import { AutoComplete, Input, Popover } from 'ant-design-vue';
  import { Icon } from '/@/components/Icon';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { useTianditu } from '/@/hooks/web/useTianditu';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { EntityKeyType, EntityKeyValueType, FilterPredicateType, NumericOperation } from '/@/enums/queryEnum';
  import dayjs from 'dayjs';
  import { router } from '/@/router';
  import { getCache, setCache } from '/@/utils/tdiot/cache';

  const { t } = useI18n();

  const entityType = ref<'DEVICE' | 'ASSET'>(((router.currentRoute.value.query.entityType as any) || 'DEVICE') as any);

  const { success, error: tdtErrorRef, T } = useTianditu(import.meta.env.VITE_TIANDITU_TK || '');
  let mapInstance: any = undefined;
  const tdtError = ref(false);
  const baseType = ref<'sat' | 'hybrid' | 'vec'>('hybrid');
  const mouseCoordText = ref('');
  let activeOverlays: any[] = [];
  let assetOverlays: any[] = [];
  let deviceOverlays: any[] = [];
  let currentMode: 'ASSET_LOW' | 'DEVICE_HIGH' | null = null;
  let loadToken = 0;
  const zoomThreshold = 17;

  // Search
  const searchText = ref('');
  const searchOptions = ref<any[]>([]);
  const searchLoading = ref(false);

  watch(searchText, () => {
    if (searchOptions.value.length > 0) {
      searchOptions.value = [];
    }
  });

  const onInputEnter = () => {
    // Always trigger search on Enter if not selecting an option
    handleSearch(searchText.value);
  };

  const handleSearch = async (val: string) => {
    if (!val) {
      searchOptions.value = [];
      return;
    }
    searchLoading.value = true;
    try {
      const serverAttrKeys = ['Longitude', 'Latitude', 'DeviceType', '监测类型', 'Stationname', '监测点名称'];
      // Search Devices
      const devicePage = await findEntityDataByQuery({
        entityFilter: { type: 'entityType', entityType: EntityType.DEVICE },
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
        ],
        pageLink: {
          page: 0,
          pageSize: 50,
          textSearch: val,
        },
        latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
      });
      // Search Assets
      const assetPage = await findEntityDataByQuery({
        entityFilter: { type: 'entityType', entityType: EntityType.ASSET },
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
        ],
        pageLink: {
          page: 0,
          pageSize: 50,
          textSearch: val,
        },
        latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
      });

      const devices = devicePage.data.map((row: any) => {
        const latest = row.latest || {};
        const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
        return {
          value: row.entityId?.id,
          label: get('ENTITY_FIELD', 'name'),
          desc: get('ENTITY_FIELD', 'label'),
          type: 'DEVICE',
          longitude: Number(get('SERVER_ATTRIBUTE', 'Longitude')),
          latitude: Number(get('SERVER_ATTRIBUTE', 'Latitude')),
        };
      });

      const assets = assetPage.data.map((row: any) => {
        const latest = row.latest || {};
        const get = (group: string, key: string) => latest?.[group]?.[key]?.value;
        return {
          value: row.entityId?.id,
          label: get('ENTITY_FIELD', 'name'),
          desc: get('ENTITY_FIELD', 'label'),
          type: 'ASSET',
          longitude: Number(get('SERVER_ATTRIBUTE', '经度')),
          latitude: Number(get('SERVER_ATTRIBUTE', '纬度')),
        };
      });

      searchOptions.value = [...devices, ...assets].filter(
        (x) => Number.isFinite(x.longitude) && Number.isFinite(x.latitude),
      );
    } catch (e) {
      console.error(e);
    } finally {
      searchLoading.value = false;
    }
  };

  const onSelect = (val: any) => {
    console.log('onSelect triggered', val);
    const target = searchOptions.value.find((item) => item.value === val);
    if (target && mapInstance && T.value && Number.isFinite(target.longitude) && Number.isFinite(target.latitude)) {
      console.log('Zooming to', target.longitude, target.latitude);
      mapInstance.centerAndZoom(new T.value.LngLat(target.longitude, target.latitude), 18);
    } else {
      console.warn('Target not found or invalid coordinates', target, mapInstance);
    }
  };

  watchEffect(() => {
    tdtError.value = tdtErrorRef.value === true;
    if (success.value) {
      initMap();
      reload();
    }
  });

  // Global navigation functions for InfoWindow links
  (window as any).__navigateToDevice = (deviceId: string) => {
    router.push(`/portal/devices/${deviceId}`);
  };
  (window as any).__navigateToAsset = (assetId: string) => {
    router.push(`/portal/assets/${assetId}`);
  };

  function initMap() {
    mapInstance = new T.value.Map('portal-tdt-map', { minZoom: 3, maxZoom: 18 });
    // applyBaseType(baseType.value); // Moved to end
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
    applyBaseType(baseType.value);
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
      const showLabel = zoom >= 18;
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
    const cacheKey = `dev:${minLng.toFixed(3)}:${minLat.toFixed(3)}:${maxLng.toFixed(3)}:${maxLat.toFixed(3)}`;
    const cached = getCache<any[]>('portal_map_devices', cacheKey);
    if (Array.isArray(cached)) {
      renderMarkers(cached);
      return;
    }
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
            id: row.entityId?.id,
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
    setCache('portal_map_devices', cacheKey, all, 24 * 60 * 60 * 1000);
    renderMarkers(all);
  }

  async function loadAssets(resetToken?: boolean) {
    const serverAttrKeys = ['经度', '纬度', 'Stationname', '监测点名称'];
    const token = resetToken ? ++loadToken : loadToken;
    let pageIndex = 0;
    const pageSize = 1000;
    const cacheKey = `asset:list:${pageSize}`;
    const cached = getCache<any[]>('portal_map_assets', cacheKey);
    if (Array.isArray(cached)) {
      renderAssetMarkers(cached);
      return;
    }
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
            id: row.entityId?.id,
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
    setCache('portal_map_assets', cacheKey, all, 24 * 60 * 60 * 1000);
    renderAssetMarkers(all);
  }

  function renderMarkers(list: Array<any>) {
    const points: any[] = [];
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
      updateVisibilty: function (showLabel: boolean) {
        if (this._labelDiv) {
          this._labelDiv.style.display = showLabel ? 'block' : 'none';
        }
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
        `<div style="margin-top:8px"><a href="javascript:void(0)" onclick="window.__navigateToDevice('${item.id}')" style="color:#1890ff;text-decoration:none">查看详情 →</a></div>` +
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
        this._clickCallback = null;
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
        container.style.cursor = 'pointer';

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
      updateVisibilty: function (showLabel: boolean) {
        if (this._labelDiv) {
          this._labelDiv.style.display = showLabel ? 'block' : 'none';
        }
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

    list.forEach((item) => {
      const pt = new T.value.LngLat(item.longitude, item.latitude);
      points.push(pt);
      const marker = new LabelMarker(pt, { text: item.stationname || item.label || item.name || '' });
      const infoHtml =
        `<div style="font-size:12px;line-height:1.6">` +
        `<div><strong>名称：</strong><span>${item.stationname || item.name || ''}</span></div>` +
        `<div><strong>标签：</strong><span>${item.label || ''}</span></div>` +
        `<div><strong>坐标：</strong><span>${item.longitude.toFixed(6)}, ${item.latitude.toFixed(6)}</span></div>` +
        `<div style="margin-top:8px"><a href="javascript:void(0)" onclick="window.__navigateToAsset('${item.id}')" style="color:#1890ff;text-decoration:none">查看详情 →</a></div>` +
        `</div>`;
      const infoWindow = new T.value.InfoWindow(infoHtml, { autoPan: true });
      marker.addEventListener('click', function () {
        marker.openInfoWindow(infoWindow);
      });
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
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    if (type === 'sat') {
      mapInstance.setMapType((window as any).TMAP_SATELLITE_MAP);
    } else if (type === 'hybrid') {
      mapInstance.setMapType((window as any).TMAP_HYBRID_MAP);
    } else if (type === 'vec') {
      mapInstance.setMapType((window as any).TMAP_NORMAL_MAP);
    }
    if (center && zoom) {
      mapInstance.centerAndZoom(center, zoom);
    }
  }

  onMounted(() => {});
</script>
