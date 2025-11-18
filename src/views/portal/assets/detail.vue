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
    </div>
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalAssetDetailPage',
  };
</script>
<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { router } from '/@/router';
  import { useTabs } from '/@/hooks/web/useTabs';
  import dayjs from 'dayjs';
  import { ASSET_FIELDS } from '/@/views/portal/config/attributes';

  const { t } = useI18n();
  const detail = ref<any>({});
  const { setTitle } = useTabs();

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
    if (typeof val === 'number' && (String(val).length >= 12)) return dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss');
    return val;
  }
  function openMap(lon?: any, lat?: any) {
    if (!lon || !lat) return;
    router.push({ path: '/portal/map', query: { center: `${lon},${lat}`, entityType: 'ASSET' } });
  }

  function goRelatedDevices() {
    const id = detail.value?.entityId?.id;
    if (id) {
      router.push({ path: '/portal/devices', query: { rootType: 'ASSET', rootId: id, direction: 'FROM', relationType: 'Contains' } });
    }
  }
</script>
