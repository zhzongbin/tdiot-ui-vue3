<template>
  <div class="p-4">
    <Description :title="t('routes.portal.deviceDetail')" :schema="descSchema" :data="detailData" bordered />
    <a v-if="hasGeo(detailData)" class="mt-3 inline-block" @click="openMap(detailData)">查看地图</a>

    <BasicDrawer v-bind="drawerBind" @register="registerDrawer">
      <div ref="mapEl" style="height: 480px"></div>
    </BasicDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, unref, nextTick } from 'vue';
  import { useRoute } from 'vue-router';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { Description } from '/@/components/Description/index';
  import type { DescItem } from '/@/components/Description/index';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { DEVICE_FIELDS } from '/@/views/portal/config/attributes';
  import { BasicDrawer, useDrawer } from '/@/components/Drawer';
  import { useBMap } from '/@/hooks/web/useBMap';

  const { t } = useI18n();
  const route = useRoute();

  const detailData = ref<Record<string, any>>({});

  function buildSchema(): DescItem[] {
    const items: DescItem[] = [];
    items.push({ field: 'name', label: '名称', span: 1 });
    for (const key of DEVICE_FIELDS.order) {
      const f = DEVICE_FIELDS.fields.find((x) => x.key === key);
      if (!f) continue;
      items.push({ field: key, label: f.alias, span: 1 });
    }
    return items;
  }

  const descSchema = buildSchema();

  async function loadDetail() {
    const id = String(route.params.deviceId);
    const res = await findEntityDataByQuery({
      entityFilter: { type: 'singleEntity', singleEntity: { id, entityType: EntityType.DEVICE } },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      latestValues: DEVICE_FIELDS.order.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k })),
      pageLink: { page: 0, pageSize: 1 },
    });
    const item = res?.data?.[0];
    const ef = item?.latest?.ENTITY_FIELD || {};
    const sa = item?.latest?.SERVER_ATTRIBUTE || {};
    const r: Record<string, any> = {};
    r.id = item?.entityId?.id ?? '';
    r.name = ef?.name?.value ?? '';
    r.type = ef?.type?.value ?? '';
    r.label = ef?.label?.value ?? '';
    r.createdTime = ef?.createdTime?.value ?? '';
    for (const key of DEVICE_FIELDS.order) {
      r[key] = sa?.[key]?.value ?? '';
    }
    detailData.value = r;
  }

  loadDetail();

  function hasGeo(record: any) {
    const lng = Number(record['Longitude']);
    const lat = Number(record['Latitude']);
    return Number.isFinite(lng) && Number.isFinite(lat);
  }

  const [registerDrawer, { openDrawer }] = useDrawer();
  const mapEl = ref<HTMLElement | null>(null);
  let map: any = null;
  let marker: any = null;
  const { success, BMapGL } = useBMap(import.meta.env.VITE_BAIDU_MAP_AK);

  const drawerBind = {
    title: '地图',
    width: 720,
    footer: null,
  };

  async function openMap(record: any) {
    await openDrawer(true);
    await nextTick();
    const lng = Number(record['Longitude']);
    const lat = Number(record['Latitude']);
    if (!unref(success)) return;
    if (!map && mapEl.value) {
      map = new BMapGL.Map(mapEl.value);
      map.enableScrollWheelZoom(true);
    }
    const point = new BMapGL.Point(lng, lat);
    map.centerAndZoom(point, 15);
    if (!marker) {
      marker = new BMapGL.Marker(point);
      map.addOverlay(marker);
    } else {
      marker.setPosition(point);
    }
  }
</script>

<style scoped></style>
