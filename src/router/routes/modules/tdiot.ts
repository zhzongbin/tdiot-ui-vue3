import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';
import { Authority } from '/@/enums/authorityEnum';
import { t } from '/@/hooks/web/useI18n';

const tdiotAnalysis: AppRouteModule = {
  path: '/tdiot-analysis',
  name: 'TdiotAnalysisTop',
  component: LAYOUT,
  meta: {
    title: t('tdiot.analysis.analysis'),
    icon: 'i-ant-design:line-chart-outlined',
    orderNo: 10,
    single: true,
    authority: [Authority.TENANT_ADMIN],
  },
  children: [
    {
      path: '/tdiot/analysis/offline',
      name: 'TdiotOfflineAnalysis',
      component: () => import('/@/views/tdiot/analysis/offline.vue'),
      meta: {
        title: t('tdiot.analysis.offlineReport'),
        icon: 'i-ant-design:monitor-outlined',
      },
    },
  ],
};

const tdiotAlerts: AppRouteModule = {
  path: '/tdiot-alerts',
  name: 'TdiotAlerts',
  component: LAYOUT,
  meta: {
    title: t('tdiot.alerts.title'),
    icon: 'i-ant-design:alert-outlined',
    orderNo: 11,
    single: true,
    authority: [Authority.TENANT_ADMIN],
  },
  children: [
    {
      path: '/tdiot/alerts',
      name: 'TdiotAlertsList',
      component: () => import('/@/views/tdiot/alerts/index.vue'),
      meta: {
        title: t('tdiot.alerts.title'),
        icon: 'i-ant-design:alert-outlined',
      },
    },
  ],
};

const tdiotImport: AppRouteModule = {
  path: '/tdiot-import',
  name: 'TdiotImport',
  component: LAYOUT,
  meta: {
    title: t('tdiot.import.title'),
    icon: 'i-ant-design:import-outlined',
    orderNo: 12,
    single: true,
    authority: [Authority.TENANT_ADMIN],
  },
  children: [
    {
      path: '/tdiot/import',
      name: 'TdiotImportPage',
      component: () => import('/@/views/tdiot/import/index.vue'),
      meta: {
        title: t('tdiot.import.title'),
        icon: 'i-ant-design:import-outlined',
      },
    },
  ],
};

export default [tdiotAnalysis, tdiotAlerts, tdiotImport];
