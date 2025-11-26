<template>
  <PageWrapper :title="t('routes.portal.assets')">
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
    <ExpExcelModal @register="registerExportModal" @success="handleExport" />
  </PageWrapper>
</template>
<script lang="ts">
  export default {
    name: 'PortalAssetsPage',
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
  import { ASSET_FIELDS } from '/@/views/portal/config/attributes';
  import { ExpExcelModal, jsonToSheetXlsx } from '/@/components/Excel';
  import { getCache, setCache } from '/@/utils/tdiot/cache';
  import { useModal } from '/@/components/Modal';
  import {
    EntityKeyType,
    EntityKeyValueType,
    FilterPredicateType,
    StringOperation,
    NumericOperation,
  } from '/@/enums/queryEnum';

  const { t } = useI18n();

  const searchParam = reactive({
    textSearch: '',
  });

  const serverAttrKeys = [
    '省级编号',
    '威胁户数（户）',
    '威胁人数（人）',
    '监测点编号',
    'relateYL',
    '监测点名称',
    '灾害类型',
    '市',
    '县（市、区）',
    '乡（镇、街道）',
    '村（居）',
    '地理位置',
    '建设级别',
    '建设单位',
    '经度',
    '纬度',
    '高程',
    '威胁财产（万元）',
    '是否隐患点',
    '隐患点状态',
    '设立日期',
    '部平台同步时间',
    '建设年份',
    '是否改建点',
    '改建年份',
    '隐患区域地形地貌名称',
    '设备厂商',
    '建设项目',
  ];

  const tableColumns: BasicColumn[] = buildColumns();

  const actionColumn: BasicColumn = {
    width: 160,
    actions: (record: any) => [
      {
        icon: 'ant-design:eye-outlined',
        title: t('routes.portal.assetDetail'),
        onClick: () => router.push(`/portal/assets/${record.entityId.id}`),
      },
      {
        icon: 'ant-design:database-outlined',
        title: t('routes.portal.devices'),
        onClick: () =>
          router.push({
            path: '/portal/devices',
            query: { rootType: 'ASSET', rootId: record.entityId.id, direction: 'FROM', relationType: 'Contains' },
          }),
      },
    ],
  };

  const [registerTable, { reload, getSelectRows, getColumns, getDataSource }] = useTable({
    rowKey: (record) => record.entityId?.id,
    api: (arg) => fetchAssets(arg),
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
          label: '类型',
          field: 'type',
          component: 'Input',
          componentProps: { allowClear: true, placeholder: '资产类型' },
        },
        {
          label: '市',
          field: 'city',
          component: 'Input',
          componentProps: { allowClear: true, placeholder: '城市' },
        },
        {
          label: '县（市、区）',
          field: 'county',
          component: 'Input',
          componentProps: { allowClear: true, placeholder: '区县' },
        },
        {
          label: '乡（镇、街道）',
          field: 'town',
          component: 'Input',
          componentProps: { allowClear: true, placeholder: '乡镇街道' },
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
    const visibleFields = ASSET_FIELDS.fields.filter((f) => f.visible);
    const ordered = ASSET_FIELDS.order.filter((k) => visibleFields.find((f) => f.key === k));
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

  async function fetchAssets(param: any) {
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
        sortOrder: {
          direction: param.sortOrder || 'DESC',
          key: { type: 'ENTITY_FIELD', key: param.sortProperty || 'createdTime' },
        },
      },
      latestValues: [...serverAttrKeys.map((k) => ({ type: 'SERVER_ATTRIBUTE', key: k }))],
      keyFilters: buildKeyFilters(param),
    };
    const cacheKey = JSON.stringify(query);
    const cachedPage = getCache<any>('portal_assets', cacheKey);
    const page = cachedPage || (await findEntityDataByQuery(query));
    if (!cachedPage) setCache('portal_assets', cacheKey, page, 24 * 60 * 60 * 1000);
    const mapped = page.data.map((row: any) => mapEntityRow(row));
    return { ...page, data: mapped };
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
        filters: [{ relationType: q.relationType || 'Contains', entityTypes: [EntityType.ASSET], negate: false }],
      };
    }
    return { type: 'entityType', entityType: EntityType.ASSET };
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
    };
    serverAttrKeys.forEach((k) => {
      entity[k] = get('SERVER_ATTRIBUTE', k);
    });
    return entity;
  }

  function buildKeyFilters(param: any) {
    const filters: any[] = [];
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
    if (param?.city) {
      filters.push({
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: '市' },
        valueType: EntityKeyValueType.STRING,
        predicate: {
          type: FilterPredicateType.STRING,
          operation: StringOperation.EQUAL,
          value: { defaultValue: param.city },
          ignoreCase: true,
        },
      });
    }
    if (param?.county) {
      filters.push({
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: '县（市、区）' },
        valueType: EntityKeyValueType.STRING,
        predicate: {
          type: FilterPredicateType.STRING,
          operation: StringOperation.EQUAL,
          value: { defaultValue: param.county },
          ignoreCase: true,
        },
      });
    }
    if (param?.town) {
      filters.push({
        key: { type: EntityKeyType.SERVER_ATTRIBUTE, key: '乡（镇、街道）' },
        valueType: EntityKeyValueType.STRING,
        predicate: {
          type: FilterPredicateType.STRING,
          operation: StringOperation.EQUAL,
          value: { defaultValue: param.town },
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
      router.replace({ path: '/portal/assets', query: {} });
      reload();
    }
  }

  const [registerExportModal, { openModal: openExportModal }] = useModal();
  function openExport() {
    openExportModal(true, {});
  }
  function handleExport({ filename, bookType }: { filename: string; bookType: string }) {
    const rows = getSelectRows() || [];
    const data = rows.length ? rows : getDataSource();
    const columns = getColumns({ ignoreIndex: true });
    const header = columns.map((c) => c.title as string);
    const keys = columns.map((c) => (c.dataIndex as string) || '');
    const arr = data.map((r: any) => {
      const o: any = {};
      keys.forEach((k, i) => (o[header[i]] = r[k]));
      return o;
    });
    jsonToSheetXlsx({ data: arr, header, filename, write2excelOpts: { bookType } as any });
  }
</script>
