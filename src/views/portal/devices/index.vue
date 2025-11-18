<template>
  <PageWrapper :title="t('routes.portal.devices')">
    <BasicTable @register="registerTable">
      <template #tableTitle>
        <div class="space-x-2">
          <a-input v-model:value="searchParam.textSearch" :placeholder="t('common.search.searchText')" allow-clear @change="reload" style="width: 260px">
            <template #suffix>
              <Icon icon="ant-design:search-outlined" />
            </template>
          </a-input>
        </div>
      </template>
    </BasicTable>
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalDevicesPage',
  };
</script>
<script lang="ts" setup>
  import { reactive, computed } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { BasicTable, useTable, BasicColumn } from '/@/components/Table';
  import { Icon } from '/@/components/Icon';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { router } from '/@/router';
  import dayjs from 'dayjs';
  import { DEVICE_FIELDS } from '/@/views/portal/config/attributes';

  const { t } = useI18n();

  const searchParam = reactive({
    textSearch: '',
  });

  const serverAttrKeys = [
    'DeviceNo','MQTT_CLIENT_ID','DeviceName','ProviceNo','StationNo','StationName','label','灾害类型','city','county','town','village',
    '建设级别','建设年份','location','Longitude','Latitude','ower','manufacturer','监测类型','DeviceType','project',
  ];

  const tableColumns: BasicColumn[] = buildColumns();

  const actionColumn: BasicColumn = {
    width: 160,
    actions: (record: any) => [
      {
        icon: 'ant-design:eye-outlined',
        title: t('routes.portal.deviceDetail'),
        onClick: () => router.push(`/portal/devices/${record.entityId.id}`),
      },
      {
        icon: 'ant-design:deployment-unit-outlined',
        title: t('routes.portal.assets'),
        onClick: () =>
          router.push({
            path: '/portal/assets',
            query: { rootType: 'DEVICE', rootId: record.entityId.id, direction: 'TO', relationType: 'Contains' },
          }),
      },
    ],
  };

  const [registerTable, { reload, setTableData }] = useTable({
    rowKey: (record) => record.entityId?.id,
    api: (arg) => fetchDevices(arg),
    columns: tableColumns,
    actionColumn: actionColumn,
    showTableSetting: true,
    useSearchForm: false,
    canResize: true,
    clickToRowSelect: false,
    defSort: { sortProperty: 'createdTime', sortOrder: 'DESC' },
  });

  function buildColumns(): BasicColumn[] {
    const cols: BasicColumn[] = [];
    const visibleFields = DEVICE_FIELDS.fields.filter((f) => f.visible);
    const ordered = DEVICE_FIELDS.order.filter((k) => visibleFields.find((f) => f.key === k));
    const aliasMap = Object.fromEntries(visibleFields.map((f) => [f.key, f.alias || f.key]));
    ordered.forEach((key) => {
      const col: BasicColumn = {
        title: aliasMap[key] || key,
        dataIndex: key,
        key,
        align: 'left',
      };
      if (key === 'lastActivityTime') {
        col.format = (val: any) => (val ? dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss') : '');
      }
      cols.push(col);
    });
    return cols;
  }

  const hasRelationFilter = computed(() => {
    const q = router.currentRoute.value.query as any;
    return !!(q && q.rootType && q.rootId && q.direction);
  });

  function buildFilterFromQueryOrDefault() {
    const q = router.currentRoute.value.query as any;
    if (q && q.rootType && q.rootId && q.direction) {
      return {
        type: 'relationsQuery',
        rootEntity: { id: q.rootId, entityType: q.rootType },
        direction: q.direction,
        maxLevel: 1,
        fetchLastLevelOnly: true,
        filters: [{ relationType: q.relationType || 'Contains', entityTypes: [EntityType.DEVICE], negate: false }],
      };
    }
    return { type: 'entityType', entityType: EntityType.DEVICE };
  }

  async function fetchDevices(param: any) {
    const query = {
      entityFilter: buildFilterFromQueryOrDefault(),
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'type' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
      ],
      pageLink: {
        page: param.page,
        pageSize: param.pageSize,
        textSearch: searchParam.textSearch || null,
        sortOrder: { direction: param.sortOrder || 'DESC', key: { type: 'ENTITY_FIELD', key: param.sortProperty || 'createdTime' } },
      },
      latestValues: [
        { type: 'ATTRIBUTE', key: 'active' },
        { type: 'ATTRIBUTE', key: 'lastActivityTime' },
        ...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k })),
      ],
    };
    const page = await findEntityDataByQuery(query);
    const mapped = page.data.map((row: any) => mapEntityRow(row));
    return { ...page, data: mapped };
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
    serverAttrKeys.forEach((k) => {
      entity[k] = get('SERVER_ATTRIBUTE', k);
    });
    return entity;
  }

  function clearRelationFilter() {
    if (hasRelationFilter.value) {
      router.replace({ path: '/portal/devices', query: {} });
      reload();
    }
  }
</script>
