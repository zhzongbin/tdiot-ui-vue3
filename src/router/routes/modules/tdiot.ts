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

export default [tdiotAnalysis];
