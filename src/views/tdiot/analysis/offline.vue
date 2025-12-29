<template>
  <div class="p-4">
    <div class="mb-4 flex justify-between items-center">
      <h1 class="text-xl font-bold">{{ t('tdiot.analysis.offlineReport') }}</h1>
      <div class="flex items-center gap-2">
        <span v-if="reportData?.generatedAt" class="text-gray-500 text-sm">
          {{ t('tdiot.analysis.lastUpdateTime') }}: {{ new Date(reportData.generatedAt).toLocaleString() }}
        </span>
        <a-button type="primary" @click="fetchReport" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </div>

    <!-- 总览卡片 -->
    <a-row :gutter="16" class="mb-6">
      <a-col :span="8">
        <a-card size="small" :bordered="false" class="status-card total">
          <a-statistic :title="t('tdiot.analysis.totalDevices')" :value="reportData?.summary.total || 0" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small" :bordered="false" class="status-card online">
          <a-statistic
            :title="t('tdiot.analysis.online')"
            :value="reportData?.summary.online || 0"
            :value-style="{ color: '#3f8600' }"
          >
            <template #prefix><CheckCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small" :bordered="false" class="status-card offline">
          <a-statistic
            :title="t('tdiot.analysis.offlineThreshold')"
            :value="reportData?.summary.offline || 0"
            :value-style="{ color: '#cf1322' }"
          >
            <template #prefix><CloseCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 表格可视化 -->
    <a-card :body-style="{ padding: '0' }" class="mb-6">
      <template #title>
        <div class="flex items-center gap-2">
          <TableOutlined />
          <span>项目离线汇总表</span>
        </div>
      </template>
      <a-table
        :columns="columns"
        :data-source="tableData"
        :pagination="false"
        size="middle"
        :row-key="(record) => record.name"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'onlineRate'">
            <div class="flex items-center gap-2" style="min-width: 120px">
              <a-progress
                :percent="record.onlineRate"
                size="small"
                :status="record.offline > 0 ? 'active' : 'success'"
                style="margin-bottom: 0"
              />
              <span class="text-xs font-medium">{{ record.onlineRate }}%</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'offline'">
            <a-tag :color="record.offline > 0 ? 'red' : 'green'">
              {{ record.offline }}
            </a-tag>
          </template>
        </template>

        <!-- 展开行：展示该项目下的离线设备详情 -->
        <template #expandedRowRender="{ record }">
          <div class="p-4 bg-gray-50 rounded">
            <div class="font-bold mb-2 flex items-center gap-2">
              <WarningOutlined class="text-red-500" />
              <span>{{ record.name }} - 离线设备明细</span>
            </div>
            <a-table
              :columns="innerColumns"
              :data-source="record.offlineDevices"
              size="small"
              :pagination="{ pageSize: 5 }"
              row-key="id"
            >
              <template #bodyCell="{ column, text }">
                <template v-if="column.dataIndex === 'status'">
                  <a-badge status="error" text="离线" />
                </template>
              </template>
            </a-table>
          </div>
        </template>
      </a-table>
    </a-card>

    <!-- 卡片式分组详情 (可选保留或删除，此处保留作为备选视图) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 hidden">
      <!-- ... 原有卡片代码 ... -->
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import {
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    TableOutlined,
    WarningOutlined,
  } from '@ant-design/icons-vue';
  import {
    Table as ATable,
    Card as ACard,
    Row as ARow,
    Col as ACol,
    Statistic as AStatistic,
    Progress as AProgress,
    Tag as ATag,
    Button as AButton,
    Badge as ABadge,
  } from 'ant-design-vue';
  import axios from 'axios';
  import { useI18n } from '/@/hooks/web/useI18n';

  const { t } = useI18n();

  interface DeviceStatus {
    name: string;
    label: string;
    id: string;
    lastActivityTime: string;
    offlineHours: string;
    status: '离线' | '在线';
  }

  interface ProjectData {
    total: number;
    offline: number;
    online: number;
    devices: DeviceStatus[];
  }

  interface ReportData {
    generatedAt: string;
    summary: {
      total: number;
      offline: number;
      online: number;
    };
    projects: Record<string, ProjectData>;
  }

  const loading = ref(false);
  const reportData = ref<ReportData | null>(null);

  // 表格列定义
  const columns = [
    { title: '项目名称', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: '总设备', dataIndex: 'total', key: 'total', align: 'center', sorter: (a, b) => a.total - b.total },
    { title: '在线', dataIndex: 'online', key: 'online', align: 'center' },
    { title: '离线', dataIndex: 'offline', key: 'offline', align: 'center', sorter: (a, b) => a.offline - b.offline },
    { title: '在线率', dataIndex: 'onlineRate', key: 'onlineRate', width: 200 },
  ];

  const innerColumns = [
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: '设备标签', dataIndex: 'label', key: 'label' },
    { title: '状态', dataIndex: 'status', key: 'status' },
    { title: '最后活跃时间', dataIndex: 'lastActivityTime', key: 'lastActivityTime' },
    { title: '离线时长(小时)', dataIndex: 'offlineHours', key: 'offlineHours' },
  ];

  // 转换数据为表格格式
  const tableData = computed(() => {
    if (!reportData.value) return [];
    return Object.entries(reportData.value.projects).map(([name, data]) => ({
      name,
      total: data.total,
      online: data.online,
      offline: data.offline,
      onlineRate: parseFloat(((data.online / data.total) * 100).toFixed(1)),
      offlineDevices: data.devices.filter((d) => d.status === '离线'),
    }));
  });

  const fetchReport = async () => {
    loading.value = true;
    try {
      // 尝试直接获取 public 下的数据文件
      // 在开发环境，BaseURL 通常是 /；在生产环境，可能是 /vue/
      // 为了兼容，我们先尝试不带前缀的绝对路径（适用于开发环境）
      let url = '/data/offline_report.json';

      // 如果是在生产构建中运行（base 为 /vue/），则需要加上前缀
      // 这里做一个简单的判断：如果 import.meta.env.PROD 为 true，或者根据实际部署情况调整
      if (import.meta.env.PROD) {
        // 根据 .env.development 中的 VITE_PUBLIC_PATH = /vue
        // 最好是从环境变量动态获取，这里先硬编码适配生产
        url = '/vue/data/offline_report.json';
      }

      const response = await axios.get(url + '?t=' + Date.now());
      reportData.value = response.data;
    } catch (error) {
      console.warn('第一次获取失败，尝试备用路径...');
      try {
        // 备用路径尝试
        const altUrl = '/vue/data/offline_report.json';
        const response = await axios.get(altUrl + '?t=' + Date.now());
        reportData.value = response.data;
      } catch (e) {
        console.error('获取报告失败:', e);
        // 模拟空数据以避免页面报错
        reportData.value = {
          generatedAt: new Date().toISOString(),
          summary: { total: 0, offline: 0, online: 0 },
          projects: {},
        };
      }
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    fetchReport();
  });
</script>

<style scoped>
  .status-card {
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
    border-left: 4px solid #d9d9d9;
  }
  .status-card.total {
    border-left-color: #1890ff;
  }
  .status-card.online {
    border-left-color: #52c41a;
  }
  .status-card.offline {
    border-left-color: #f5222d;
  }
</style>
