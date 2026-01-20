export default {
  title: '批量导入',
  steps: {
    instructions: '说明',
    selectServer: '选择服务器',
    importAssets: '导入资产',
    importDevices: '导入设备',
    result: '结果',
  },
  instructions: {
    title: '导入说明',
    content: '本向导将引导您完成资产（地灾点）和设备的批量导入。请准备好您的 Excel 或 CSV 数据文件。',
    serverYangqiao: '杨桥服务器 (61.131.1.193:9090)',
    serverJinshan: '金山服务器 (59.56.62.110:9090)',
  },
  server: {
    label: '目标服务器',
    selectTip: '请确认数据要导入到哪个服务器节点',
  },
  asset: {
    uploadTitle: '上传资产列表',
    uploadTip: '点击或拖拽文件到此处上传',
    mapTitle: '映射资产属性',
    confirmImport: '确认导入资产',
    columns: {
      name: '名称',
      code: '编码',
      type: '类型',
    },
  },
  device: {
    uploadTitle: '上传设备列表',
    uploadTip: '点击或拖拽文件到此处上传',
    mapTitle: '映射设备属性',
    confirmImport: '确认导入设备',
    associationPrompt:
      '检测到设备 "{deviceName}" 可能属于资产 "{assetName}" (匹配 StationNo: {stationNo})。是否建立关联？',
    autoAssociate: '自动关联',
  },
  actions: {
    next: '下一步',
    prev: '上一步',
    finish: '完成',
    mapping: '确认映射',
    reset: '重置',
  },
};
