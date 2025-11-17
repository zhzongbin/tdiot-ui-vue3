import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';
import { t } from '/@/hooks/web/useI18n';
import { Authority } from '/@/enums/authorityEnum';

const portalRoutes: AppRouteModule = {
  path: '/portal',
  name: 'Portal',
  component: LAYOUT,
  redirect: '/portal/devices',
  meta: {
    title: t('routes.portal.front'),
    icon: 'i-ant-design:deployment-unit-outlined',
    orderNo: 30,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: 'devices',
      name: 'PortalDevices',
      component: () => import('/@/views/portal/devices/index.vue'),
      meta: {
        title: t('routes.portal.devices'),
        icon: 'i-ant-design:database-outlined',
      },
    },
    {
      path: 'assets',
      name: 'PortalAssets',
      component: () => import('/@/views/portal/assets/index.vue'),
      meta: {
        title: t('routes.portal.assets'),
        icon: 'i-ant-design:appstore-outlined',
      },
    },
    {
      path: 'devices/:deviceId',
      name: 'PortalDeviceDetail',
      component: () => import('/@/views/portal/devices/detail.vue'),
      meta: {
        title: t('routes.portal.deviceDetail'),
        hideMenu: true,
        currentActiveMenu: '/portal/devices',
      },
    },
    {
      path: 'assets/:assetId',
      name: 'PortalAssetDetail',
      component: () => import('/@/views/portal/assets/detail.vue'),
      meta: {
        title: t('routes.portal.assetDetail'),
        hideMenu: true,
        currentActiveMenu: '/portal/assets',
      },
    },
    {
      path: 'map',
      name: 'PortalMap',
      component: () => import('/@/views/portal/map/index.vue'),
      meta: {
        title: t('routes.portal.map'),
        icon: 'i-ant-design:compass-outlined',
        single: true,
      },
    },
  ],
};

export default [portalRoutes];