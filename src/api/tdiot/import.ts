import axios from 'axios';
import { getToken } from '/@/utils/auth';
import { ContentTypeEnum } from '/@/enums/httpEnum';

const SERVERS = {
  yangqiao: 'http://61.131.1.193:9090',
  jinshan: 'http://59.56.62.110:9090',
};

// Helper to create a client for a specific server
const createClient = (serverKey: string, token?: string) => {
  const baseURL = SERVERS[serverKey];
  const useToken = token || getToken();

  const instance = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': ContentTypeEnum.JSON,
      'X-Authorization': `Bearer ${useToken}`,
    },
  });

  return instance;
};

export const login = (serverKey: string, params: any) => {
  // We use a clean axios instance for login to avoid using the partial token
  const baseURL = SERVERS[serverKey];
  return axios.post(`${baseURL}/api/auth/login`, params);
};

export const saveAsset = (serverKey: string, asset: any, token?: string) => {
  const client = createClient(serverKey, token);
  return client.post('/api/asset', asset);
};

export const saveEntityAttributes = (
  serverKey: string,
  entityType: string,
  entityId: any,
  scope: string,
  attributes: any,
  token?: string,
) => {
  const client = createClient(serverKey, token);
  return client.post(`/api/plugins/telemetry/${entityType}/${entityId}/${scope}`, attributes);
};

export const saveDevice = (serverKey: string, device: any, token?: string) => {
  const client = createClient(serverKey, token);
  return client.post('/api/device', device);
};

export const saveDeviceCredentials = (serverKey: string, deviceId: any, credentials: any, token?: string) => {
  const client = createClient(serverKey, token);
  return client.post('/api/device/credentials', {
    deviceId: { id: deviceId, entityType: 'DEVICE' },
    ...credentials,
  });
};

export const saveEntityRelation = (serverKey: string, relation: any, token?: string) => {
  const client = createClient(serverKey, token);
  return client.post('/api/relation', relation);
};

export const getTenantAssets = (serverKey: string, limit = 1000, token?: string) => {
  const client = createClient(serverKey, token);
  return client.get(`/api/tenant/assets?pageSize=${limit}&page=0`);
};

export const getAssetByName = (serverKey: string, name: string, token?: string) => {
  const client = createClient(serverKey, token);
  return client.get(`/api/tenant/assets?assetName=${encodeURIComponent(name)}`);
};

export const getDeviceByName = (serverKey: string, name: string, token?: string) => {
  const client = createClient(serverKey, token);
  return client.get(`/api/tenant/devices?deviceName=${encodeURIComponent(name)}`);
};
