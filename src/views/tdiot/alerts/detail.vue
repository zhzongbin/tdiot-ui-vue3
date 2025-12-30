<template>
  <BasicDrawer v-bind="$attrs" @register="registerDrawer" title="告警详情" width="50%">
    <div class="p-4">
      <Description @register="registerDesc" :data="currentAlarm" />
      <div class="mt-4">
        <div class="mb-2 font-bold">{{ t('tdiot.alerts.detail.details') }}:</div>
        <CodeEditor v-model:value="detailsJson" :mode="MODE.JSON" readonly style="height: 300px" />
      </div>
      <div class="mt-6 flex justify-end gap-4">
        <a-button type="primary" success @click="handleReport">
          上报省级平台
        </a-button>
        <a-button type="primary" danger v-if="showAck" @click="handleAck" :loading="loading">
          {{ t('tdiot.alerts.detail.ack') }}
        </a-button>
        <a-button type="primary" warning v-if="showClear" @click="handleClear" :loading="loading">
          {{ t('tdiot.alerts.detail.clear') }}
        </a-button>
        <a-button @click="closeDrawer">{{ t('tdiot.alerts.detail.returnToDevice') }}</a-button>
      </div>
    </div>
    <BasicModal
      @register="registerModal"
      title="确认上报信息"
      @ok="confirmReport"
      :confirmLoading="reportLoading"
    >
      <CodeEditor v-model:value="reportData" :mode="MODE.JSON" style="height: 400px" />
    </BasicModal>
  </BasicDrawer>
</template>
<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { Description, useDescription } from '/@/components/Description';
  import { CodeEditor, MODE } from '/@/components/CodeEditor';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { ackAlarm, clearAlarm } from '/@/api/tb/alarm';
  import { getToken, uploadWarning } from '/@/api/tdiot/provincial';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { BasicModal, useModal } from '/@/components/Modal';
  import dayjs from 'dayjs';

  const { t } = useI18n();
  const { createMessage } = useMessage();
  const loading = ref(false);
  const alarmId = ref('');
  const detailsJson = ref('');
  const currentAlarm = ref<any>({});
  const reportData = ref('');
  const reportLoading = ref(false);

  const emit = defineEmits(['success', 'register']);

  const [registerDesc] = useDescription({
    column: 2,
    schema: [
      { field: 'name', label: t('tdiot.alerts.detail.name') },
      { field: 'severity', label: t('tdiot.alerts.detail.severity') },
      { field: 'status', label: t('tdiot.alerts.detail.status') },
      { field: 'type', label: t('tdiot.alerts.detail.type') },
      {
        field: 'startTs',
        label: t('tdiot.alerts.detail.startTime'),
        render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        field: 'endTs',
        label: t('tdiot.alerts.detail.endTime'),
        render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ],
  });

  const [registerDrawer, { closeDrawer }] = useDrawerInner((data) => {
    currentAlarm.value = data;
    alarmId.value = data.id.id;
    detailsJson.value = JSON.stringify(data.details || {}, null, 2);
  });

  const [registerModal, { openModal, closeModal }] = useModal();

  const showAck = computed(() => {
    const status = currentAlarm.value.status || '';
    return status.includes('UNACK');
  });

  const showClear = computed(() => {
    const status = currentAlarm.value.status || '';
    return !status.includes('CLEARED');
  });

  async function handleAck() {
    if (!alarmId.value) return;
    loading.value = true;
    try {
      await ackAlarm(alarmId.value);
      createMessage.success(t('tdiot.alerts.detail.ackSuccess'));
      emit('success');
      closeDrawer();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  async function handleClear() {
    if (!alarmId.value) return;
    loading.value = true;
    try {
      await clearAlarm(alarmId.value);
      createMessage.success(t('tdiot.alerts.detail.clearSuccess'));
      emit('success');
      closeDrawer();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  function handleReport() {
    const details = currentAlarm.value.details || {};
    
    // Attempt to parse WarningDevices if it exists or construct it from individual fields in details
    const warningDevices = details.WarningDevices || [
      {
        SensorCode: details.SensorCode || 'undefined',
        TriggerValue: details.TriggerValue || 'undefined',
        TriggerType: details.TriggerType || 'undefined'
      }
    ];

    const initialData = {
      MonitorPointCode: currentAlarm.value.monitoringPoint || details.MonitorPointCode || 'undefined',
      WarningLevel: currentAlarm.value.severity || details.WarningLevel || 'undefined',
      WarningMsgID: currentAlarm.value.id?.id || details.WarningMsgID || 'undefined',
      Time: currentAlarm.value.createdTime ? dayjs(currentAlarm.value.createdTime).format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm'),
      WarningContent: details.WarningContent || details.data || JSON.stringify(details),
      WarningDevices: warningDevices
    };
    reportData.value = JSON.stringify(initialData, null, 2);
    openModal(true);
  }

  async function confirmReport() {
    reportLoading.value = true;
    try {
      const tokenRes = await getToken();
      const token = tokenRes.data || tokenRes;
      
      let body = {};
      try {
        body = JSON.parse(reportData.value);
      } catch (e) {
        createMessage.error('JSON格式错误');
        reportLoading.value = false;
        return;
      }

      await uploadWarning(token, body);
      createMessage.success('上报成功');
      closeModal();
    } catch (e) {
      console.error('Report failed', e);
      createMessage.error('上报失败');
    } finally {
      reportLoading.value = false;
    }
  }
</script>
