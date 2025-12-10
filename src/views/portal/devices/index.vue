<template>
  <PageWrapper :title="t('routes.portal.devices')">
    <BasicTable @register="registerTable">
      <template #tableTitle>
        <div class="space-x-2">
          <a-input
            v-model:value="searchParam.textSearch"
            :placeholder="t('common.search.searchText')"
            allow-clear
            @change="reload"
            style="width: 260px"
          >
            <template #suffix>
              <Icon icon="ant-design:search-outlined" />
            </template>
          </a-input>
        </div>
      </template>
      <template #toolbar>
        <a-space>
          <a-button type="primary" @click="openExport">{{ t('component.excel.exportModalTitle') }}</a-button>
          <a-button v-if="hasRelationFilter" @click="clearRelationFilter">清除关联筛选</a-button>
        </a-space>
      </template>
    </BasicTable>
    <ExpExcelModal @register="registerExportModal" @success="handleExport" :showExportSelect="true" />
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalDevicesPage',
  };
</script>
<script lang="ts" setup>
  import { reactive, computed, ref, h } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { BasicTable, useTable, BasicColumn } from '/@/components/Table';
  import { Icon } from '/@/components/Icon';
  import { findEntityDataByQuery } from '/@/api/tb/entityQuery';
  import { EntityType } from '/@/enums/entityTypeEnum';
  import { router } from '/@/router';
  import dayjs from 'dayjs';
  import { DEVICE_FIELDS } from '/@/views/portal/config/attributes';
  import { ExpExcelModal, aoaToSheetXlsx } from '/@/components/Excel';
  import { getCache, setCache } from '/@/utils/tdiot/cache';
  import { useModal } from '/@/components/Modal';
  import {
    EntityKeyType,
    EntityKeyValueType,
    FilterPredicateType,
    StringOperation,
    NumericOperation,
    BooleanOperation,
  } from '/@/enums/queryEnum';

  const { t } = useI18n();

  const searchParam = reactive({
    textSearch: '',
  });

  const serverAttrKeys = [
    'DeviceNo',
    'MQTT_CLIENT_ID',
    'DeviceName',
    'ProviceNo',
    'StationNo',
    'StationName',
    'label',
    '灾害类型',
    'city',
    'county',
    'town',
    'village',
    '建设级别',
    '建设年份',
    'location',
    'Longitude',
    'Latitude',
    'ower',
    'manufacturer',
    '监测类型',
    'DeviceType',
    'project',
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

  const [registerTable, { reload, setTableData, getSelectRows, getColumns, getDataSource, getPagination, getForm }] =
    useTable({
      rowKey: (record) => record.entityId?.id,
      api: (arg) => fetchDevices(arg),
      columns: tableColumns,
      actionColumn: actionColumn,
      showTableSetting: true,
      useSearchForm: true,
      showSelectionBar: true,
      canResize: true,
      clickToRowSelect: false,
      defSort: { sortProperty: 'createdTime', sortOrder: 'DESC' },
      formConfig: {
        layout: 'inline',
        showResetButton: true,
        showSubmitButton: true,
        baseColProps: { lg: 6, md: 8, sm: 12 },
        schemas: [
          {
            label: '状态',
            field: 'active',
            component: 'Select',
            defaultValue: undefined,
            componentProps: {
              allowClear: true,
              options: [
                { label: '全部', value: undefined },
                { label: '在线', value: true },
                { label: '离线', value: false },
              ],
            },
          },
          {
            label: '类型',
            field: 'type',
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '设备类型' },
          },
          {
            label: 'DeviceType',
            field: 'deviceType',
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '设备厂商类型' },
          },
          {
            label: '所属资产',
            field: 'assetId',
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '资产ID（支持从资产详情跳转）' },
          },
          {
            label: '创建时间',
            field: 'createdRange',
            component: 'RangePicker',
            componentProps: { allowClear: true, showTime: true },
          },
        ],
      },
    });

  function buildColumns(): BasicColumn[] {
    const cols: BasicColumn[] = [];
    const fieldMap = new Map(DEVICE_FIELDS.fields.map((f) => [f.key, f]));

    DEVICE_FIELDS.order.forEach((key) => {
      const field = fieldMap.get(key);
      if (!field) return;

      const col: BasicColumn = {
        title: field.alias || key,
        dataIndex: key,
        key,
        align: 'left',
        width: 150, // Default width
        defaultHidden: !field.visible,
      };
      if (key === 'name') {
        col.width = 200;
        col.customRender = ({ record }) => {
          return h(
            'a',
            {
              class: 'font-bold text-blue-600 hover:underline',
              onClick: (e: Event) => {
                e.stopPropagation();
                router.push(`/portal/devices/${record.entityId.id}`);
              },
            },
            record.name,
          );
        };
      }
      if (key === 'active') {
        col.align = 'center';
        col.width = 100;
        col.customRender = ({ record }) => {
          const isActive = record.active;
          return h(
            'span',
            {
              style: {
                color: isActive ? '#52c41a' : '#f5222d',
                fontWeight: 'bold',
              },
            },
            isActive ? '在线' : '离线',
          );
        };
      }
      if (key === 'lastActivityTime' || key === 'createdTime') {
        col.align = 'center';
        col.width = 180;
        col.format = (val: any) => (val ? dayjs(Number(val)).format('YYYY-MM-DD HH:mm:ss') : '-');
      }
      // Adjust widths for specific columns
      if (['DeviceNo', 'StationNo', 'ProviceNo'].includes(key)) col.width = 120;
      if (['StationName', 'project', 'ower'].includes(key)) col.width = 180;

      cols.push(col);
    });
    return cols;
  }

  const hasRelationFilter = computed(() => {
    const q = router.currentRoute.value.query as any;
    return !!(q && q.rootType && q.rootId && q.direction);
  });

  function buildFilterFromQueryOrDefault(param?: any) {
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
    if (param?.assetId) {
      return {
        type: 'relationsQuery',
        rootEntity: { id: param.assetId, entityType: EntityType.ASSET },
        direction: 'FROM',
        maxLevel: 1,
        fetchLastLevelOnly: true,
        filters: [{ relationType: 'Contains', entityTypes: [EntityType.DEVICE], negate: false }],
      };
    }
    return { type: 'entityType', entityType: EntityType.DEVICE };
  }

  async function fetchDevices(param: any) {
    const query = {
      entityFilter: buildFilterFromQueryOrDefault(param),
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
        sortOrder: {
          direction: param.sortOrder || 'DESC',
          key: { type: 'ENTITY_FIELD', key: param.sortProperty || 'createdTime' },
        },
      },
      latestValues: [
        { type: 'ATTRIBUTE', key: 'active' },
        { type: 'ATTRIBUTE', key: 'lastActivityTime' },
        ...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k })),
      ],
      keyFilters: buildKeyFilters(param),
    };
    const cacheKey = JSON.stringify(query);
    const cachedPage = getCache<any>('portal_devices', cacheKey);
    const page = cachedPage || (await findEntityDataByQuery(query));
    if (!cachedPage) setCache('portal_devices', cacheKey, page, 24 * 60 * 60 * 1000);
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

  function buildKeyFilters(param: any) {
    const filters: any[] = [];
    if (typeof param?.active === 'boolean') {
      filters.push({
        key: { type: EntityKeyType.ATTRIBUTE, key: 'active' },
        valueType: EntityKeyValueType.BOOLEAN,
        predicate: {
          type: FilterPredicateType.BOOLEAN,
          operation: BooleanOperation.EQUAL,
          value: { defaultValue: param.active },
        },
      });
    }
    if (param?.type) {
      filters.push({
        key: { type: EntityKeyType.ENTITY_FIELD, key: 'type' },
        valueType: EntityKeyValueType.STRING,
        predicate: {
          type: FilterPredicateType.STRING,
          operation: StringOperation.EQUAL,
          value: { defaultValue: param.type },
          ignoreCase: true,
        },
      });
    }
    if (param?.deviceType) {
      filters.push({
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: 'DeviceType' },
        valueType: EntityKeyValueType.STRING,
        predicate: {
          type: FilterPredicateType.STRING,
          operation: StringOperation.EQUAL,
          value: { defaultValue: param.deviceType },
          ignoreCase: true,
        },
      });
    }
    if (param?.createdRange && Array.isArray(param.createdRange) && param.createdRange.length === 2) {
      const start = dayjs(param.createdRange[0]).valueOf();
      const end = dayjs(param.createdRange[1]).valueOf();
      filters.push({
        key: { type: EntityKeyType.ENTITY_FIELD, key: 'createdTime' },
        valueType: EntityKeyValueType.DATE_TIME,
        predicate: {
          type: FilterPredicateType.COMPLEX,
          operation: 'AND',
          predicates: [
            {
              type: FilterPredicateType.NUMERIC,
              operation: NumericOperation.GREATER_OR_EQUAL,
              value: { defaultValue: start },
            },
            {
              type: FilterPredicateType.NUMERIC,
              operation: NumericOperation.LESS_OR_EQUAL,
              value: { defaultValue: end },
            },
          ],
        },
      });
    }
    return filters.length ? filters : undefined;
  }

  function clearRelationFilter() {
    if (hasRelationFilter.value) {
      router.replace({ path: '/portal/devices', query: {} });
      reload();
    }
  }

  const [registerExportModal, { openModal: openExportModal }] = useModal();
  function openExport() {
    openExportModal(true, {});
  }
  async function handleExport({
    filename,
    bookType,
    exportScope,
  }: {
    filename: string;
    bookType: string;
    exportScope?: 'current' | 'all';
  }) {
    let data: any[] = [];
    if (exportScope === 'all') {
      const pagination = getPagination() as any;
      const total = pagination?.total || 0;
      const formValues = getForm().getFieldsValue();
      const res = await fetchDevices({
        page: 0,
        pageSize: total || 10000,
        ...formValues,
      });
      data = res.data;
    } else {
      const rows = getSelectRows() || [];
      data = rows.length ? rows : getDataSource();
    }

    const columns = getColumns({ ignoreIndex: true });
    // Fix: Filter out columns without dataIndex or that are action columns
    const validColumns = columns.filter((c) => (c.dataIndex || c.key) && c.key !== 'action');

    const header = validColumns.map((c) => c.title as string);
    const keys = validColumns.map((c) => (c.dataIndex || c.key) as string);

    const arr = data.map((r: any) => {
      return keys.map((k) => r[k]);
    });
    aoaToSheetXlsx({ data: arr, header, filename, write2excelOpts: { bookType } as any });
  }
</script>
