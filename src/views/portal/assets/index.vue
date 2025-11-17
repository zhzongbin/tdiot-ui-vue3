<template>
  <div class="p-4">
    <BasicTable
      @register="registerTable"
      :title="tableTitle"
      :columns="tableColumns"
      :actionColumn="actionColumn"
      :showTableSetting="true"
      :useSearchForm="true"
      :defSort="defSort"
      :canResize="true"
    >
      <template #nameCell="{ text, record }">
        <a @click="openAssetDetail(record)">{{ text }}</a>
      </template>
      <template #lngCell="{ text, record }">
        <a @click="openMap(record)">{{ text }}</a>
      </template>
      <template #latCell="{ text, record }">
        <a @click="openMap(record)">{{ text }}</a>
      </template>
      <template #geoAction="{ record }">
        <a v-if="hasGeo(record)" @click="openMap(record)">查看地图</a>
      </template>
    </BasicTable>

    <BasicDrawer v-bind="drawerBind" @register="registerDrawer">
      <div ref="mapEl" style="height: 480px"></div>
    </BasicDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, unref, computed, nextTick } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { BasicTable, useTable } from '/@/components/Table';
  import type { BasicColumn } from '/@/components/Table';
  import { BasicDrawer, useDrawer } from '/@/components/Drawer';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { ASSET_FIELDS } from '/@/views/portal/config/attributes';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { useBMap } from '/@/hooks/web/useBMap';

  const { t } = useI18n();
  const router = useRouter();
  const route = useRoute();

  const defSort = { sortProperty: 'createdTime', sortOrder: 'DESC' };

  function buildColumns(): BasicColumn[] {
    const cols: BasicColumn[] = [];
    cols.push({ title: '名称', dataIndex: 'name', key: 'name', width: 180, align: 'left', slot: 'nameCell' });
    for (const key of ASSET_FIELDS.order) {
      const f = ASSET_FIELDS.fields.find((x) => x.key === key);
      if (!f) continue;
      cols.push({ title: f.alias, dataIndex: f.key, key: f.key, ellipsis: true, align: 'left' });
    }
    return cols;
  }

  const tableColumns = buildColumns();

  function buildRelationsFilter() {
    const q: any = route.query;
    if (q && q.rootType && q.rootId && q.direction && q.relationType) {
      return {
        type: 'relationsQuery',
        rootEntity: { id: String(q.rootId), entityType: String(q.rootType) },
        direction: String(q.direction),
        filters: [
          {
            relationType: String(q.relationType),
            entityTypes: [EntityType.ASSET],
          },
        ],
        maxLevel: 1,
        fetchLastLevelOnly: false,
      };
    }
  }

  async function fetchAssets(params: any) {
    const page = params?.page ?? 0;
    const pageSize = params?.pageSize ?? 20;
    const textSearch = params?.searchInfo?.q ?? '';
    const searchFilters = params?.searchInfo ?? {};

    const ef = buildRelationsFilter();
    const entityFilter = ef ?? { type: 'entityType', entityType: EntityType.ASSET };

    const latestValues = ASSET_FIELDS.order.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }));
    const entityFields = [
      { type: 'ENTITY_FIELD', key: 'name' },
      { type: 'ENTITY_FIELD', key: 'type' },
      { type: 'ENTITY_FIELD', key: 'label' },
      { type: 'ENTITY_FIELD', key: 'createdTime' },
    ];

    const keyFilters: any[] = [];
    if (searchFilters['灾害类型']) {
      keyFilters.push({
        valueType: 'STRING',
        key: { key: '灾害类型', type: 'SERVER_ATTRIBUTE' },
        predicate: { operation: 'EQUAL', type: 'STRING', value: { defaultValue: searchFilters['灾害类型'] } },
      });
    }
    if (searchFilters['市']) {
      keyFilters.push({
        valueType: 'STRING',
        key: { key: '市', type: 'SERVER_ATTRIBUTE' },
        predicate: { operation: 'EQUAL', type: 'STRING', value: { defaultValue: searchFilters['市'] } },
      });
    }
    if (searchFilters['县（市、区）']) {
      keyFilters.push({
        valueType: 'STRING',
        key: { key: '县（市、区）', type: 'SERVER_ATTRIBUTE' },
        predicate: { operation: 'EQUAL', type: 'STRING', value: { defaultValue: searchFilters['县（市、区）'] } },
      });
    }
    if (searchFilters['relateYL']) {
      keyFilters.push({
        valueType: 'NUMERIC',
        key: { key: 'relateYL', type: 'SERVER_ATTRIBUTE' },
        predicate: { operation: 'EQUAL', type: 'NUMERIC', value: { defaultValue: Number(searchFilters['relateYL']) } },
      });
    }

    return await findEntityDataByQuery({
      entityFilter,
      latestValues,
      entityFields,
      pageLink: {
        page,
        pageSize,
        textSearch,
        sortOrder: { direction: 'DESC', key: { type: 'ENTITY_FIELD', key: 'createdTime' } },
      },
      keyFilters,
    });
  }

  function flatten(items: any[]) {
    return items.map((x) => {
      const r: Record<string, any> = {};
      r.id = x.entityId?.id ?? x.entityId;
      const ef = x.latest?.ENTITY_FIELD || {};
      r.name = ef?.name?.value ?? '';
      r.type = ef?.type?.value ?? '';
      r.label = ef?.label?.value ?? '';
      r.createdTime = ef?.createdTime?.value ?? '';
      const sa = x.latest?.SERVER_ATTRIBUTE || {};
      for (const key of ASSET_FIELDS.order) {
        r[key] = sa?.[key]?.value ?? '';
      }
      return r;
    });
  }

  const [registerTable, { reload }] = useTable({
    rowKey: (record) => record.id?.id ?? record.id,
    api: fetchAssets,
    defSort,
    columns: tableColumns,
    showTableSetting: true,
    useSearchForm: true,
    formConfig: {
      layout: 'inline',
      schemas: [
        {
          field: 'q',
          label: '搜索',
          component: 'Input',
          colProps: { span: 6 },
          componentProps: { placeholder: '名称/标签' },
        },
        { field: '灾害类型', label: '灾害类型', component: 'Input', colProps: { span: 6 } },
        { field: '市', label: '市', component: 'Input', colProps: { span: 6 } },
        { field: '县（市、区）', label: '县（市、区）', component: 'Input', colProps: { span: 6 } },
        { field: 'relateYL', label: '关联雨量', component: 'InputNumber', colProps: { span: 6 } },
      ],
      showAdvancedButton: false,
      showActionButtonGroup: true,
    },
    afterFetch: flatten,
    canResize: true,
  });

  const actionColumn: BasicColumn = {
    title: '操作',
    key: 'actions',
    dataIndex: 'actions',
    width: 120,
    slot: 'geoAction',
  };

  const tableTitle = computed(() => t('routes.portal.assets'));

  function openAssetDetail(record: any) {
    const id = record.id?.id ?? record.id;
    router.push({ name: 'PortalAssetDetail', params: { assetId: id } });
  }

  function hasGeo(record: any) {
    const lng = Number(record['经度']);
    const lat = Number(record['纬度']);
    return Number.isFinite(lng) && Number.isFinite(lat);
  }

  const [registerDrawer, { openDrawer, closeDrawer, setProps: setDrawerProps }] = useDrawer();
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
    const lng = Number(record['经度']);
    const lat = Number(record['纬度']);
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