<template>
  <BasicDrawer v-bind="$attrs" @register="registerDrawer" title="告警详情" width="50%">
    <div class="p-4">
      <Description @register="registerDesc" />
      <div class="mt-4">
        <div class="mb-2 font-bold">{{ t('tdiot.alerts.detail.details') }}:</div>
        <CodeEditor v-model:value="detailsJson" mode="application/json" readonly style="height: 300px" />
      </div>
      <div class="mt-6 flex justify-end gap-4">
        <a-button type="primary" danger v-if="showAck" @click="handleAck" :loading="loading">
          {{ t('tdiot.alerts.detail.ack') }}
        </a-button>
        <a-button type="primary" warning v-if="showClear" @click="handleClear" :loading="loading">
          {{ t('tdiot.alerts.detail.clear') }}
        </a-button>
        <a-button @click="closeDrawer">{{ t('tdiot.alerts.detail.returnToDevice') }}</a-button>
      </div>
    </div>
  </BasicDrawer>
</template>
<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { Description, useDescription } from '/@/components/Description';
  import { CodeEditor } from '/@/components/CodeEditor';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { ackAlarm, clearAlarm } from '/@/api/tb/alarm';
  import { useMessage } from '/@/hooks/web/useMessage';
  import dayjs from 'dayjs';

  const { t } = useI18n();
  const { createMessage } = useMessage();
  const loading = ref(false);
  const alarmId = ref('');
  const detailsJson = ref('');
  const currentAlarm = ref<any>({});

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
</script>
