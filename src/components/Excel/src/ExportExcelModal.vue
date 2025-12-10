<template>
  <BasicModal v-bind="$attrs" :title="t('component.excel.exportModalTitle')" @ok="handleOk" @register="registerModal">
    <BasicForm :labelWidth="100" :schemas="schemas" :showActionButtonGroup="false" @register="registerForm" />
  </BasicModal>
</template>
<script lang="ts">
  import type { ExportModalResult } from './typing';
  import { defineComponent, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, FormSchema, useForm } from '/@/components/Form';

  import { useI18n } from '/@/hooks/web/useI18n';

  const { t } = useI18n();

  const baseSchemas: FormSchema[] = [
    {
      field: 'filename',
      component: 'Input',
      label: t('component.excel.fileName'),
      rules: [{ required: true }],
    },
    {
      field: 'bookType',
      component: 'Select',
      label: t('component.excel.fileType'),
      defaultValue: 'xlsx',
      rules: [{ required: true }],
      componentProps: {
        options: [
          {
            label: 'xlsx',
            value: 'xlsx',
            key: 'xlsx',
          },
          {
            label: 'html',
            value: 'html',
            key: 'html',
          },
          {
            label: 'csv',
            value: 'csv',
            key: 'csv',
          },
          {
            label: 'txt',
            value: 'txt',
            key: 'txt',
          },
        ],
      },
    },
  ];
  export default defineComponent({
    components: { BasicModal, BasicForm },
    props: {
      showExportSelect: { type: Boolean, default: false },
    },
    emits: ['success', 'register'],
    setup(props, { emit }) {
      const { t } = useI18n();
      const [registerForm, { validateFields }] = useForm();
      const [registerModal, { closeModal }] = useModalInner();

      const schemas = computed(() => {
        const s = [...baseSchemas];
        if (props.showExportSelect) {
          s.push({
            field: 'exportScope',
            component: 'Select',
            label: '导出范围',
            defaultValue: 'current',
            colProps: { span: 24 },
            componentProps: {
              options: [
                { label: '当前页', value: 'current' },
                { label: '所有页', value: 'all' },
              ],
            },
          });
        }
        return s;
      });

      async function handleOk() {
        const res = (await validateFields()) as ExportModalResult;
        const { filename, bookType, exportScope } = res;
        emit('success', {
          filename: `${filename.split('.').shift()}.${bookType}`,
          bookType,
          exportScope,
        });
        closeModal();
      }

      return {
        schemas,
        handleOk,
        registerForm,
        registerModal,
        t,
      };
    },
  });
</script>
