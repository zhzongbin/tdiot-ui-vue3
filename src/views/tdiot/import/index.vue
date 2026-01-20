<template>
  <div class="p-4">
    <div class="mb-4 bg-white p-4 rounded-md shadow">
      <Steps :current="currentStep">
        <Step :title="t('tdiot.import.steps.instructions')" />
        <Step :title="t('tdiot.import.steps.selectServer')" />
        <Step :title="t('tdiot.import.steps.importAssets')" />
        <Step :title="t('tdiot.import.steps.importDevices')" />
        <Step :title="t('tdiot.import.steps.result')" />
      </Steps>
    </div>

    <!-- Step 0: Instructions -->
    <div v-show="currentStep === 0" class="bg-white p-6 rounded-md shadow min-h-100">
      <h2 class="text-xl font-bold mb-4">{{ t('tdiot.import.instructions.title') }}</h2>
      <p class="mb-4">{{ t('tdiot.import.instructions.content') }}</p>

      <div class="flex justify-end mt-8">
        <Button type="primary" @click="nextStep">{{ t('tdiot.import.actions.next') }}</Button>
      </div>
    </div>

    <!-- Step 1: Server Selection -->
    <div v-show="currentStep === 1" class="bg-white p-6 rounded-md shadow min-h-100">
      <h2 class="text-xl font-bold mb-4">{{ t('tdiot.import.server.label') }}</h2>
      <Alert :message="t('tdiot.import.server.selectTip')" type="info" show-icon class="mb-6" />

      <div class="mb-6 border p-4 rounded bg-gray-50">
        <h3 class="font-bold mb-2">认证配置 (Authentication)</h3>
        <p class="text-xs text-gray-500 mb-2">
          如果目标服务器需要认证，请输入。默认值仅作参考。
          <br />If target servers require authentication, please enter. Default values are for reference only.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <FormItem label="用户名 (Username)">
            <Input v-model:value="authForm.username" placeholder="tenant@thingsboard.org" />
          </FormItem>
          <FormItem label="密码 (Password)">
            <InputPassword v-model:value="authForm.password" placeholder="tenant" />
          </FormItem>
        </div>
      </div>

      <CheckboxGroup v-model:value="selectedServers" class="w-full">
        <div class="flex flex-col gap-4">
          <Checkbox value="yangqiao" class="border p-4 rounded hover:bg-gray-50 transition w-full bg-white block">
            <span class="font-bold ml-2">{{ t('tdiot.import.instructions.serverYangqiao') }}</span>
          </Checkbox>
          <Checkbox value="jinshan" class="border p-4 rounded hover:bg-gray-50 transition w-full bg-white block">
            <span class="font-bold ml-2">{{ t('tdiot.import.instructions.serverJinshan') }}</span>
          </Checkbox>
        </div>
      </CheckboxGroup>

      <div class="flex justify-between mt-8">
        <Button @click="prevStep">{{ t('tdiot.import.actions.prev') }}</Button>
        <Button type="primary" :disabled="selectedServers.length === 0" @click="confirmServer">{{
          t('tdiot.import.actions.next')
        }}</Button>
      </div>
    </div>

    <!-- Step 2: Asset Import -->
    <div v-show="currentStep === 2" class="bg-white p-6 rounded-md shadow min-h-100">
      <h2 class="text-xl font-bold mb-4">{{ t('tdiot.import.asset.uploadTitle') }}</h2>

      <div v-if="!assetFile">
        <UploadDragger name="file" :showUploadList="false" :beforeUpload="handleAssetUpload" accept=".xlsx,.csv">
          <p class="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text">{{ t('tdiot.import.asset.uploadTip') }}</p>
        </UploadDragger>
      </div>

      <div v-else>
        <div class="mb-4 flex justify-between items-center">
          <span class="font-bold text-green-600">已加载文件: {{ assetFile.name }} ({{ assetData.length }} 条记录)</span>
          <Button type="dashed" danger @click="resetAsset">{{ t('tdiot.import.actions.reset') }}</Button>
        </div>

        <!-- Strategy -->
        <div class="mb-6 border p-4 rounded bg-blue-50">
          <h3 class="font-bold mb-2">导入策略 (Strategy)</h3>
          <RadioGroup v-model:value="assetStrategy">
            <Radio value="create">仅新增 (如存在则跳过)</Radio>
            <Radio value="update">允许更新 (如存在则覆盖)</Radio>
          </RadioGroup>
        </div>

        <!-- Mapping UI -->
        <div class="mb-6 border p-4 rounded bg-gray-50">
          <h3 class="font-bold mb-2">{{ t('tdiot.import.asset.mapTitle') }}</h3>
          <div class="grid grid-cols-2 gap-4">
            <FormItem label="资产名称 (Name)">
              <Select v-model:value="assetMapping.name" style="width: 100%">
                <SelectOption v-for="col in assetColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="资产编码 (Code/ID)">
              <Select v-model:value="assetMapping.code" style="width: 100%">
                <SelectOption v-for="col in assetColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="类型 (Type)">
              <Select v-model:value="assetMapping.type" style="width: 100%">
                <SelectOption v-for="col in assetColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
          </div>
        </div>

        <Table
          :dataSource="previewAssetData"
          :columns="previewAssetColumns"
          size="small"
          :pagination="{ pageSize: 5 }"
        />
      </div>

      <div class="flex justify-between mt-8">
        <Button @click="prevStep">{{ t('tdiot.import.actions.prev') }}</Button>
        <Button type="primary" :disabled="!assetFile" @click="processAssetImport">{{
          t('tdiot.import.asset.confirmImport')
        }}</Button>
      </div>
    </div>

    <!-- Step 3: Device Import -->
    <div v-show="currentStep === 3" class="bg-white p-6 rounded-md shadow min-h-100">
      <h2 class="text-xl font-bold mb-4">{{ t('tdiot.import.device.uploadTitle') }}</h2>

      <div v-if="!deviceFile">
        <UploadDragger name="file" :showUploadList="false" :beforeUpload="handleDeviceUpload" accept=".xlsx,.csv">
          <p class="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text">{{ t('tdiot.import.device.uploadTip') }}</p>
        </UploadDragger>
      </div>

      <div v-else>
        <div class="mb-4 flex justify-between items-center">
          <span class="font-bold text-green-600"
            >已加载文件: {{ deviceFile.name }} ({{ deviceData.length }} 条记录)</span
          >
          <Button type="dashed" danger @click="resetDevice">{{ t('tdiot.import.actions.reset') }}</Button>
        </div>

        <!-- Strategy -->
        <div class="mb-6 border p-4 rounded bg-blue-50">
          <h3 class="font-bold mb-2">导入策略 (Strategy)</h3>
          <RadioGroup v-model:value="deviceStrategy">
            <Radio value="create">仅新增 (如存在则跳过)</Radio>
            <Radio value="update">允许更新 (如存在则覆盖)</Radio>
          </RadioGroup>
        </div>

        <!-- Mapping UI -->
        <div class="mb-6 border p-4 rounded bg-gray-50">
          <h3 class="font-bold mb-2">{{ t('tdiot.import.device.mapTitle') }}</h3>
          <div class="grid grid-cols-3 gap-4">
            <FormItem label="设备名称 (Name)">
              <Select v-model:value="deviceMapping.name" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="设备标签 (Label)">
              <Select v-model:value="deviceMapping.label" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="设备配置 (Profile/Type)">
              <Select v-model:value="deviceMapping.type" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="关联站点号 (StationNo)">
              <Select v-model:value="deviceMapping.stationNo" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="MQTT Username">
              <Select v-model:value="deviceMapping.user" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
            <FormItem label="MQTT ClientID">
              <Select v-model:value="deviceMapping.mqttClientId" style="width: 100%">
                <SelectOption v-for="col in deviceColumns" :key="col" :value="col">{{ col }}</SelectOption>
              </Select>
            </FormItem>
          </div>
        </div>

        <Alert message="自动关联提示" type="info" show-icon class="mb-4">
          <template #description>
            系统将根据 <b>StationNo</b> 自动查找名称中包含该编号的资产，并建议建立关联。
          </template>
        </Alert>

        <Table
          :dataSource="previewDeviceData"
          :columns="previewDeviceColumns"
          size="small"
          :pagination="{ pageSize: 5 }"
        />
      </div>

      <div class="flex justify-between mt-8">
        <Button @click="prevStep">{{ t('tdiot.import.actions.prev') }}</Button>
        <Button type="primary" :disabled="!deviceFile" @click="processDeviceImport">{{
          t('tdiot.import.device.confirmImport')
        }}</Button>
      </div>
    </div>

    <!-- Step 4: Result -->
    <div
      v-show="currentStep === 4"
      class="bg-white p-6 rounded-md shadow min-h-100 flex flex-col items-center justify-center"
    >
      <div class="text-6xl text-green-500 mb-4">
        <!-- <check-circle-outlined /> -->
        ✓
      </div>
      <h2 class="text-2xl font-bold mb-2">导入流程结束</h2>
      <p class="mb-6 text-gray-500"> 请查看下方日志确认详细结果。 </p>
      <Button type="primary" @click="currentStep = 0">{{ t('tdiot.import.actions.finish') }}</Button>
    </div>

    <!-- Terminal Log -->
    <div
      class="mt-4 bg-black rounded-md p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner"
      ref="terminalRef"
    >
      <div v-for="(line, index) in logLines" :key="index" class="whitespace-pre-wrap">{{ line }}</div>
      <div v-if="logLines.length === 0" class="text-gray-600">等待操作...</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, nextTick, watch } from 'vue';
  import { useI18n } from '/@/hooks/web/useI18n';
  import {
    message,
    Checkbox,
    CheckboxGroup,
    Button,
    Alert,
    Upload,
    Select,
    Table,
    Form,
    Steps,
    Input,
    InputPassword,
    Radio,
    RadioGroup,
  } from 'ant-design-vue';
  import { InboxOutlined } from '@ant-design/icons-vue';
  import { read, utils } from 'xlsx';

  import {
    saveAsset,
    saveDevice,
    saveEntityRelation,
    login,
    saveEntityAttributes,
    saveDeviceCredentials,
    getAssetByName,
    getDeviceByName,
  } from '/@/api/tdiot/import';

  const UploadDragger = Upload.Dragger;
  const SelectOption = Select.Option;
  const FormItem = Form.Item;
  const Step = Steps.Step;

  const { t } = useI18n();
  const currentStep = ref(0);
  const selectedServers = ref(['yangqiao', 'jinshan']);

  const authForm = ref({
    username: 'tenant@thingsboard.org',
    password: 'tenant',
  });

  const assetStrategy = ref('create'); // create | update
  const deviceStrategy = ref('create'); // create | update

  // Cache tokens: serverKey -> token
  const serverTokens = ref<Record<string, string>>({});

  // Terminal
  const logLines = ref<string[]>([]);
  const terminalRef = ref<HTMLElement | null>(null);

  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    logLines.value.push(`[${time}] ${msg}`);
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
      }
    });
  };

  const getErrorMessage = (e: any) => {
    // Axios error
    if (e.response && e.response.data) {
      return e.response.data.message || JSON.stringify(e.response.data);
    }
    return e.message || '未知错误';
  };

  // Helper to ensure login
  const ensureLogin = async (server: string) => {
    if (serverTokens.value[server]) return serverTokens.value[server];

    log(`[${server}] 正在登录... (${authForm.value.username})`);
    try {
      const res = await login(server, { username: authForm.value.username, password: authForm.value.password });
      const token = res.data.token;
      serverTokens.value[server] = token;
      log(`[${server}] 登录成功`);
      return token;
    } catch (e: any) {
      log(`[${server}] 登录失败: ${getErrorMessage(e)}`);
      throw e; // Propagate error
    }
  };

  // --- Assets ---
  const assetFile = ref<File | null>(null);
  const assetData = ref<any[]>([]);
  const assetColumns = ref<string[]>([]);
  const assetMapping = ref({ name: '', code: '', type: 'default' });
  const importedAssetsCount = ref(0);

  // Cache created assets for relation linking later: serverKey -> assetName -> assetStringId
  const createdAssetsMap = ref<Record<string, Record<string, any>>>({});

  const handleAssetUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = read(data, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = utils.sheet_to_json(worksheet);

      assetData.value = json;
      assetFile.value = file;

      if (json.length > 0) {
        assetColumns.value = Object.keys(json[0] as object);
        // Auto-guess mapping
        const keys = assetColumns.value;
        assetMapping.value.name = keys.find((k) => k.includes('名称') || k.toLowerCase().includes('name')) || '';
        assetMapping.value.code = keys.find((k) => k.includes('编码') || k.toLowerCase().includes('code')) || '';
        const typeCol = keys.find((k) => k.includes('类型') || k.toLowerCase().includes('type'));
        if (typeCol) assetMapping.value.type = typeCol;
      }
    };
    reader.readAsBinaryString(file);
    return false; // Prevent auto upload
  };

  const resetAsset = () => {
    assetFile.value = null;
    assetData.value = [];
    assetColumns.value = [];
  };

  const previewAssetData = computed(() => assetData.value.slice(0, 5));
  const previewAssetColumns = computed(() =>
    assetColumns.value.map((col) => ({ title: col, dataIndex: col, key: col })),
  );

  const processAssetImport = async () => {
    if (selectedServers.value.length === 0) {
      message.error('请先选择目标服务器');
      return;
    }

    log(`=== 开始导入资产 (策略: ${assetStrategy.value === 'create' ? '仅新增' : '允许更新'}) ===`);
    let totalSuccess = 0;

    for (const server of selectedServers.value) {
      log(`>>> 连接服务器: ${server}...`);

      let token = '';
      try {
        token = await ensureLogin(server);
      } catch (e) {
        log(`[${server}] 认证失败，跳过该服务器`);
        continue;
      }

      createdAssetsMap.value[server] = {};

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;

      for (const row of assetData.value) {
        const name = row[assetMapping.value.name];
        const type = '地灾点'; // Force type as requested

        if (!name) {
          log(`[${server}] 跳过无效行: 名称为空`);
          continue;
        }

        // Split Attributes
        // Only name and type in body (and label=name). Everything else to attributes.
        const attributes: any = {};
        for (const key of Object.keys(row)) {
          if (key !== assetMapping.value.name && key !== assetMapping.value.type) {
            attributes[key] = row[key];
          }
        }

        let assetBody: any = {
          name: name,
          type: type,
          label: name,
        };

        let isUpdate = false;
        let assetId = null;

        try {
          // Try Create first
          const res = await saveAsset(server, assetBody, token);
          assetId = res.data.id.id; // Corrected from res.id.id based on typical Axios response
          createdAssetsMap.value[server][name] = res.data;
          successCount++;
        } catch (e: any) {
          // Error handling
          if (assetStrategy.value === 'update') {
            // Try fetch by name
            try {
              const existing = await getAssetByName(server, name, token);
              if (existing && existing.data) {
                assetId = existing.data.id.id;
                assetBody.id = existing.data.id; // Include ID for update
                // Retry Save (Update)
                const updateRes = await saveAsset(server, assetBody, token);
                createdAssetsMap.value[server][name] = updateRes.data;
                log(`[${server}] 更新资产 '${name}' 成功`);
                isUpdate = true;
                successCount++;
              } else {
                throw e;
              }
            } catch (fetchErr: any) {
              log(`[${server}] 更新资产 '${name}' 失败: ${getErrorMessage(e)}`);
              failCount++;
              continue;
            }
          } else {
            // Create only - log error
            const msg = getErrorMessage(e);
            if (msg.includes('exists') || e.response?.status === 400) {
              log(`[${server}] 跳过资产 '${name}': 已存在`);
              skipCount++;
            } else {
              log(`[${server}] 创建资产 '${name}' 失败: ${msg}`);
              failCount++;
            }
            continue;
          }
        }

        // 2. Save Attributes
        if (assetId && Object.keys(attributes).length > 0) {
          try {
            // Pass 'ASSET' as EntityType
            await saveEntityAttributes(server, 'ASSET', assetId, 'SERVER_SCOPE', attributes, token);
          } catch (attErr: any) {
            log(`[${server}] 保存属性失败 '${name}': ${getErrorMessage(attErr)}`);
          }
        }
      }
      log(`[${server}] 资产导入完成. 成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}`);
      totalSuccess += successCount;
    }

    importedAssetsCount.value = totalSuccess;
    message.success(`资产导入完成`);
    nextStep();
  };

  // --- Devices ---
  const deviceFile = ref<File | null>(null);
  const deviceData = ref<any[]>([]);
  const deviceColumns = ref<string[]>([]);
  const deviceMapping = ref({ name: '', label: '', stationNo: '', user: '', mqttClientId: '', type: '' });
  const importedDevicesCount = ref(0);

  const handleDeviceUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = read(data, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = utils.sheet_to_json(worksheet);

      deviceData.value = json;
      deviceFile.value = file;

      if (json.length > 0) {
        deviceColumns.value = Object.keys(json[0] as object);
        const keys = deviceColumns.value;
        deviceMapping.value.name = keys.find((k) => k.includes('名称') || k.toLowerCase().includes('name')) || '';
        deviceMapping.value.label = keys.find((k) => k.includes('标签') || k.toLowerCase().includes('label')) || '';
        deviceMapping.value.type =
          keys.find((k) => k.includes('配置') || k.includes('Profile') || k.includes('Type')) || '';
        deviceMapping.value.stationNo = keys.find((k) => k.includes('StationNo') || k.includes('站点')) || '';
        deviceMapping.value.user = keys.find((k) => k.includes('user') || k.includes('用户')) || '';
        deviceMapping.value.mqttClientId =
          keys.find((k) => k.includes('MQTT_CLIENT_ID') || k.includes('ClientId')) || '';
      }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const resetDevice = () => {
    deviceFile.value = null;
    deviceData.value = [];
    deviceColumns.value = [];
  };

  const previewDeviceData = computed(() => deviceData.value.slice(0, 5));
  const previewDeviceColumns = computed(() =>
    deviceColumns.value.map((col) => ({ title: col, dataIndex: col, key: col })),
  );

  const processDeviceImport = async () => {
    log(`=== 开始导入设备 (策略: ${deviceStrategy.value === 'create' ? '仅新增' : '允许更新'}) ===`);
    let totalSuccess = 0;

    for (const server of selectedServers.value) {
      log(`>>> 连接服务器: ${server}...`);

      let token = '';
      try {
        token = await ensureLogin(server);
      } catch (e: any) {
        log(`[${server}] 认证失败，跳过: ${getErrorMessage(e)}`);
        continue;
      }

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;
      let linkCount = 0;

      for (const row of deviceData.value) {
        const name = row[deviceMapping.value.name];
        const label = row[deviceMapping.value.label] || name;
        // Map Type. If mapped column has value, use it. Else 'default'.
        let type = 'default';
        if (deviceMapping.value.type && row[deviceMapping.value.type]) {
          type = row[deviceMapping.value.type];
        }

        const stationNo = row[deviceMapping.value.stationNo];

        // Credentials
        const mqttUser = row[deviceMapping.value.user];
        // If mapping exists for client id use it, otherwise use mqttUser/Name? User said 'MQTT_CLIENT_ID'
        const mqttClientId = deviceMapping.value.mqttClientId ? row[deviceMapping.value.mqttClientId] : null;

        if (!name) {
          log(`[${server}] 跳过无效行: 名称为空`);
          continue;
        }

        // Attributes split
        const attributes: any = {};
        const skippedKeys = [
          deviceMapping.value.name,
          deviceMapping.value.label,
          deviceMapping.value.type,
          deviceMapping.value.user,
          deviceMapping.value.mqttClientId,
          // also stationNo maybe? Keep it in attributes too if useful? Yes.
        ];

        for (const key of Object.keys(row)) {
          if (!skippedKeys.includes(key)) {
            attributes[key] = row[key];
          }
        }

        let deviceBody: any = {
          name: name,
          label: label,
          type: type, // Mapped type
        };

        let deviceId = null;

        try {
          // 1. Create Device
          const deviceRes = await saveDevice(server, deviceBody, token);
          deviceId = deviceRes.data.id.id;
          successCount++;
        } catch (e: any) {
          if (deviceStrategy.value === 'update') {
            // Try fetch by name
            try {
              const existing = await getDeviceByName(server, name, token);
              if (existing && existing.data) {
                deviceId = existing.data.id.id;
                deviceBody.id = existing.data.id; // Include ID for update
                // Retry Save (Update)
                await saveDevice(server, deviceBody, token);
                log(`[${server}] 更新设备 '${name}' 成功`);
                successCount++;
              } else {
                throw e;
              }
            } catch (fetchErr: any) {
              log(`[${server}] 更新设备 '${name}' 失败: ${getErrorMessage(e)}`);
              failCount++;
              continue;
            }
          } else {
            // Create only - log error
            const msg = getErrorMessage(e);
            if (msg.includes('exists') || e.response?.status === 400) {
              log(`[${server}] 跳过设备 '${name}': 已存在`);
              skipCount++;
            } else {
              log(`[${server}] 创建设备 '${name}' 失败: ${msg}`);
              failCount++;
            }
            continue;
          }
        }

        // If we have a valid deviceId, proceed with Credentials, Attributes, Relations
        if (!deviceId) continue;

        // 2. Save Credentials (MQTT)
        if (mqttUser || mqttClientId) {
          try {
            const creds = {
              credentialsType: 'MQTT_BASIC',
              credentialsId: mqttClientId || name, // Fallback to name if ID missing
              // Ensure credentialsValue is not null. Use empty string or user provided or default?
              // TB requires not null.
              credentialsValue: mqttUser || '',
            };
            await saveDeviceCredentials(server, deviceId, creds, token);
          } catch (credErr: any) {
            log(`[${server}] 保存凭证失败 '${name}': ${getErrorMessage(credErr)}`);
          }
        }

        // 3. Save Attributes
        if (Object.keys(attributes).length > 0) {
          try {
            // Pass 'DEVICE' as EntityType
            await saveEntityAttributes(server, 'DEVICE', deviceId, 'SERVER_SCOPE', attributes, token);
          } catch (attErr: any) {
            log(`[${server}] 保存属性失败 '${name}': ${getErrorMessage(attErr)}`);
          }
        }

        // ASSOCIATION Logic (same as before)
        if (stationNo) {
          const assets = createdAssetsMap.value[server] || {};
          let matchedAssetId = null;
          let matchedAssetName = '';

          for (const aName in assets) {
            if (String(aName).includes(String(stationNo))) {
              matchedAssetId = assets[aName].id.id; // Fix: get .id.id
              matchedAssetName = aName;
              break;
            }
          }

          if (matchedAssetId) {
            try {
              const relation = {
                from: { id: matchedAssetId, entityType: 'ASSET' }, // Fix: full entityId
                to: { id: deviceId, entityType: 'DEVICE' },
                type: 'Contains',
                typeGroup: 'COMMON',
              };
              await saveEntityRelation(server, relation, token);
              log(`[${server}] 关联成功: 资产[${matchedAssetName}] -> 设备[${name}]`);
              linkCount++;
            } catch (re) {
              // ignore
            }
          }
        }
      }
      log(
        `[${server}] 设备导入完成. 成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}, 关联: ${linkCount}`,
      );
      totalSuccess += successCount;
    }

    importedDevicesCount.value = totalSuccess;
    message.success(`设备导入完成`);
    nextStep();
  };

  // --- Navigation ---
  const nextStep = () => {
    if (currentStep.value < 4) currentStep.value++;
  };
  const prevStep = () => {
    if (currentStep.value > 0) currentStep.value--;
  };
  const confirmServer = () => {
    log(`已选择服务器: ${selectedServers.value.join(', ')}`);
    nextStep();
  };
</script>

<style scoped>
  .ant-upload-text {
    margin-top: 8px;
    color: #666;
  }
</style>
