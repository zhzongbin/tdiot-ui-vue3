<template>
  <PageWrapper :title="t('routes.portal.deviceDetail')">
    <div class="space-y-6">
      <div class="flex gap-2">
        <a-button type="primary" @click="goRelatedAssets">查看所属地灾点</a-button>
      </div>
      <a-card :title="t('routes.portal.devices')">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('basic')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.device.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('device')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.site.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item v-for="key in groupOrder('site')" :key="key" :label="alias(key)">
            {{ displayValue(detail[key]) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-card :title="DEVICE_FIELDS.groups.geo.title">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="alias('Longitude')">
            <a @click="openMap(detail['Longitude'], detail['Latitude'])">{{ displayValue(detail['Longitude']) }}</a>
          </a-descriptions-item>
          <a-descriptions-item :label="alias('Latitude')">
            <a @click="openMap(detail['Longitude'], detail['Latitude'])">{{ displayValue(detail['Latitude']) }}</a>
          </a-descriptions-item>
        </a-descriptions>
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
  import dayjs from 'dayjs';
  import { DEVICE_FIELDS } from '/@/views/portal/config/attributes';

  const { t } = useI18n();
  const detail = ref<any>({});

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

  function alias(key: string) {
    const f = DEVICE_FIELDS.fields.find((x) => x.key === key);
    return f?.alias || key;
  }
  function groupOrder(groupKey: string) {
    return DEVICE_FIELDS.groups[groupKey]?.order || [];
  }
  function displayValue(val: any) {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number' && (String(val).length >= 12)) return dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss');
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
    router.push({ path: '/portal/assets', query: { rootType: 'DEVICE', rootId: id, direction: 'TO', relationType: 'Contains' } });
  }
</script>