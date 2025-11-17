import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';
import { t } from '/@/hooks/web/useI18n';
import { Authority } from '/@/enums/authorityEnum';

const portalDevicesTop: AppRouteModule = {
  path: '/portal-devices',
  name: 'PortalDevicesTop',
  component: LAYOUT,
  meta: {
    title: t('routes.portal.devices'),
    icon: 'i-ant-design:database-outlined',
    orderNo: 5,
    single: true,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: '/portal/devices',
      name: 'PortalDevices',
      component: () => import('/@/views/portal/devices/index.vue'),
      meta: {
        title: t('routes.portal.devices'),
        icon: 'i-ant-design:database-outlined',
      },
    },
  ],
};

const portalAssetsTop: AppRouteModule = {
  path: '/portal-assets',
  name: 'PortalAssetsTop',
  component: LAYOUT,
  meta: {
    title: t('routes.portal.assets'),
    icon: 'i-ant-design:appstore-outlined',
    orderNo: 6,
    single: true,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: '/portal/assets',
      name: 'PortalAssets',
      component: () => import('/@/views/portal/assets/index.vue'),
      meta: {
        title: t('routes.portal.assets'),
        icon: 'i-ant-design:appstore-outlined',
      },
    },
  ],
};

const portalMapTop: AppRouteModule = {
  path: '/portal-map',
  name: 'PortalMapTop',
  component: LAYOUT,
  meta: {
    title: t('routes.portal.map'),
    icon: 'i-ant-design:compass-outlined',
    orderNo: 7,
    single: true,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: '/portal/map',
      name: 'PortalMap',
      component: () => import('/@/views/portal/map/index.vue'),
      meta: {
        title: t('routes.portal.map'),
        icon: 'i-ant-design:compass-outlined',
      },
    },
  ],
};

const deviceAccessTop: AppRouteModule = {
  path: '/device-access',
  name: 'DeviceAccessTop',
  component: LAYOUT,
  meta: {
    title: t('routes.tb.device'),
    icon: 'ant-design:database-outlined',
    orderNo: 8,
    single: true,
    ignoreRoute: true,
    hideMenu: true,
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
  children: [
    {
      path: '/device/list',
      name: 'DeviceAccessLink',
      meta: {
        title: t('routes.tb.device'),
        icon: 'ant-design:database-outlined',
      },
    },
  ],
};


// detail pages as standalone leaf routes
export const portalDeviceDetail: AppRouteModule = {
  path: '/portal/devices/:deviceId',
  name: 'PortalDeviceDetail',
  component: () => import('/@/views/portal/devices/detail.vue'),
  meta: {
    title: t('routes.portal.deviceDetail'),
    hideMenu: true,
    currentActiveMenu: '/portal/devices',
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
};

export const portalAssetDetail: AppRouteModule = {
  path: '/portal/assets/:assetId',
  name: 'PortalAssetDetail',
  component: () => import('/@/views/portal/assets/detail.vue'),
  meta: {
    title: t('routes.portal.assetDetail'),
    hideMenu: true,
    currentActiveMenu: '/portal/assets',
    authority: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
  },
};

export default [
  portalDevicesTop,
  portalAssetsTop,
  portalMapTop,
  deviceAccessTop,
  portalDeviceDetail,
  portalAssetDetail,
];