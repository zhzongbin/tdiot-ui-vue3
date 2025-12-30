<template>
  <PageWrapper :title="t('tdiot.alerts.title')">
    <a-card :bordered="false">
      <BasicTable @register="registerTable">
        <template #toolbar>
          <div class="flex items-center">
            <span class="mr-2">{{ t('tdiot.alerts.filter.status') }}:</span>
            <Radio.Group v-model:value="alarmStatus" button-style="solid" @change="handleAlarmStatusChange">
              <Radio.Button value="ANY">{{ t('tdiot.alerts.filter.all') }}</Radio.Button>
              <Radio.Button value="ACTIVE">{{ t('tdiot.alerts.filter.active') }}</Radio.Button>
              <Radio.Button value="CLEARED">{{ t('tdiot.alerts.filter.cleared') }}</Radio.Button>
              <Radio.Button value="ACK">{{ t('tdiot.alerts.filter.ack') }}</Radio.Button>
            </Radio.Group>
          </div>
        </template>
        <template #action="{ record }">
          <TableAction
            :actions="[
              {
                label: t('tdiot.alerts.detail.details'),
                onClick: openAlarmDetail.bind(null, record),
              },
            ]"
          />
        </template>
      </BasicTable>
    </a-card>
    <AlarmDetailDrawer @register="registerDrawer" @success="handleAlarmActionSuccess" />
  </PageWrapper>
</template>

<script lang="ts" setup>
  import { ref, h } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { PageWrapper } from '/@/components/Page';
  import { BasicTable, useTable, BasicColumn, TableAction } from '/@/components/Table';
  import { Radio, Tag } from 'ant-design-vue';
  import { findAlarmDataByQuery } from '/@/api/tb/entityQuery';
  import { useDrawer } from '/@/components/Drawer';
  import AlarmDetailDrawer from './detail.vue';
  import dayjs from 'dayjs';
  import { AlarmSeverity } from '/@/enums/alarmEnum';
  import { EntityType } from '/@/enums/entityTypeEnum';

  const { t } = useI18n();
  const alarmStatus = ref('ANY');

  const [registerDrawer, { openDrawer }] = useDrawer();

  const [registerTable, { reload: reloadAlarms }] = useTable({
    api: fetchAlarms,
    columns: getColumns(),
    useSearchForm: false,
    showTableSetting: true,
    bordered: true,
    showIndexColumn: false,
    pagination: { pageSize: 10 },
    canResize: true,
    rowKey: (record) => record.id.id,
    fetchSetting: {
      pageField: 'page',
      sizeField: 'pageSize',
      listField: 'items',
      totalField: 'total',
    },
    actionColumn: {
      width: 120,
      title: t('common.action'),
      dataIndex: 'action',
      slots: { customRender: 'action' },
    },
  });

  function handleAlarmStatusChange() {
    reloadAlarms({ page: 1 });
  }

  function openAlarmDetail(record: any) {
    openDrawer(true, record);
  }

  function handleAlarmActionSuccess() {
    reloadAlarms();
  }

  function getColumns(): BasicColumn[] {
    return [
      {
        title: t('tdiot.alerts.columns.deviceName'),
        dataIndex: 'originatorName',
        width: 180,
      },
      {
        title: t('tdiot.alerts.columns.deviceNo'),
        dataIndex: 'deviceNo',
        width: 150,
      },
      {
        title: t('tdiot.alerts.columns.monitoringPoint'),
        dataIndex: 'monitoringPoint',
        width: 180,
      },
      {
        title: t('tdiot.alerts.columns.severity'),
        dataIndex: 'severity',
        width: 120,
        customRender: ({ record }) => {
          const color = getSeverityColor(record.severity);
          const text = getSeverityText(record.severity);
          return h(Tag, { color }, () => text);
        },
      },
      {
        title: t('tdiot.alerts.columns.status'),
        dataIndex: 'status',
        width: 120,
        customRender: ({ record }) => {
          return getStatusText(record.status);
        },
      },
      {
        title: t('tdiot.alerts.columns.time'),
        dataIndex: 'createdTime',
        width: 180,
        format: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ];
  }

  function getSeverityColor(severity: AlarmSeverity) {
    switch (severity) {
      case AlarmSeverity.CRITICAL:
        return 'red';
      case AlarmSeverity.MAJOR:
        return 'orange';
      case AlarmSeverity.MINOR:
        return 'gold';
      case AlarmSeverity.WARNING:
        return 'blue';
      case AlarmSeverity.INDETERMINATE:
        return 'purple';
      default:
        return 'default';
    }
  }

  function getSeverityText(severity: AlarmSeverity) {
    switch (severity) {
      case AlarmSeverity.CRITICAL:
        return '红色';
      case AlarmSeverity.MAJOR:
        return '橙色';
      case AlarmSeverity.MINOR:
        return '黄色';
      case AlarmSeverity.WARNING:
        return '蓝色';
      case AlarmSeverity.INDETERMINATE:
        return '紫色';
      default:
        return severity;
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'ACTIVE_UNACK':
        return '激活未确认';
      case 'ACTIVE_ACK':
        return '激活已确认';
      case 'CLEARED_UNACK':
        return '已清除未确认';
      case 'CLEARED_ACK':
        return '已清除已确认';
      default:
        return status;
    }
  }

  async function fetchAlarms(params: any) {
    const statusList = alarmStatus.value === 'ANY' ? [] : [alarmStatus.value];

    const query = {
      entityFilter: {
        type: 'entityType',
        entityType: EntityType.DEVICE,
      },
      pageLink: {
        page: params.page > 0 ? params.page - 1 : 0,
        pageSize: params.pageSize,
        textSearch: null,
        sortOrder: {
          direction: params.sortOrder || 'DESC',
          key: { type: 'ALARM_FIELD', key: params.sortProperty || 'createdTime' },
        },
        searchPropagatedAlarms: false,
        statusList: statusList,
      },
      alarmFields: [
        { type: 'ALARM_FIELD', key: 'name' },
        { type: 'ALARM_FIELD', key: 'status' },
        { type: 'ALARM_FIELD', key: 'severity' },
        { type: 'ALARM_FIELD', key: 'createdTime' },
        { type: 'ALARM_FIELD', key: 'originatorName' },
      ],
      entityFields: [
         { type: 'ENTITY_FIELD', key: 'name' },
      ],
      latestValues: [
        { type: 'SERVER_ATTRIBUTE', key: '监测点名称' },
        { type: 'SERVER_ATTRIBUTE', key: 'DeviceNo' }, 
        // Also trying Equipment Number just in case
        { type: 'SERVER_ATTRIBUTE', key: '设备编号' },
      ],
    };

    try {
      const res = await findAlarmDataByQuery(query);
      const items = res.data.map((item: any) => ({
        ...item,
        id: item.id,
        createdTime: item.createdTime,
        name: item.latest?.ALARM_FIELD?.name?.value || item.name || '',
        status: item.latest?.ALARM_FIELD?.status?.value || item.status || '',
        severity: item.latest?.ALARM_FIELD?.severity?.value || item.severity || '',
        originatorName: item.latest?.ALARM_FIELD?.originatorName?.value || item.originatorName || '',
        monitoringPoint: item.latest?.SERVER_ATTRIBUTE?.监测点名称?.value || '',
        deviceNo: item.latest?.SERVER_ATTRIBUTE?.DeviceNo?.value || item.latest?.SERVER_ATTRIBUTE?.设备编号?.value || '',
      }));
      return { items: items, total: res.totalElements };
    } catch (error) {
      console.error('fetchAlarms error:', error);
      return { items: [], total: 0 };
    }
  }
</script>
