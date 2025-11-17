import type { AppRouteModule } from '/@/router/types';

import { LAYOUT } from '/@/router/constant';
import { t } from '/@/hooks/web/useI18n';
import { Authority } from '/@/enums/authorityEnum';

const portal: AppRouteModule = {
  path: '/portal',
  name: 'Portal',
  component: LAYOUT,
  redirect: '/portal/devices',
  meta: {
    orderNo: 15,
    icon: 'ant-design:deployment-unit-outlined',
    tabIcon: 'ant-design:deployment-unit-outlined',
    title: t('routes.portal.front'),
    single: false,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: '/portal/devices',
      name: 'PortalDevices',
      component: () => import('/@/views/portal/devices/index.vue'),
      meta: {
        orderNo: 10,
        icon: 'ant-design:database-outlined',
        tabIcon: 'ant-design:database-outlined',
        title: t('routes.portal.devices'),
        authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
      },
    },
    {
      path: '/portal/assets',
      name: 'PortalAssets',
      component: () => import('/@/views/portal/assets/index.vue'),
      meta: {
        orderNo: 20,
        icon: 'ant-design:desktop-outlined',
        tabIcon: 'ant-design:desktop-outlined',
        title: t('routes.portal.assets'),
        authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
      },
    },
    {
      path: '/portal/devices/:deviceId',
      name: 'PortalDeviceDetail',
      component: () => import('/@/views/portal/devices/detail.vue'),
      meta: {
        icon: 'ant-design:database-outlined',
        tabIcon: 'ant-design:database-outlined',
        title: t('routes.portal.deviceDetail'),
        authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
        hideMenu: true,
        currentActiveMenu: '/portal/devices',
      },
    },
    {
      path: '/portal/assets/:assetId',
      name: 'PortalAssetDetail',
      component: () => import('/@/views/portal/assets/detail.vue'),
      meta: {
        icon: 'ant-design:desktop-outlined',
        tabIcon: 'ant-design:desktop-outlined',
        title: t('routes.portal.assetDetail'),
        authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
        hideMenu: true,
        currentActiveMenu: '/portal/assets',
      },
    },
  ],
};

export default portal;
