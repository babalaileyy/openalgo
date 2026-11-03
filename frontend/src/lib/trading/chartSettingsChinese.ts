import { chartSettingLabel } from './indicatorChinese'

/** Chart-settings display text. Keys and option values are never translated. */
const labels: Record<string, string> = {
  Timezone: '时区', 'Open interest': '持仓量', Volume: '成交量', Histogram: '柱状图',
  'Match candle colours': '颜色跟随 K 线', 'Moving average': '移动平均线', 'Show moving average': '显示移动平均线',
  Colour: '颜色', Sessions: '交易时段', 'All sessions': '所有时段', 'Custom hours': '自定义时段',
  'Session start (HH:mm)': '时段开始（时:分）', 'Session end (HH:mm)': '时段结束（时:分）',
  'TPO calculation': 'TPO 计算', 'TPO appearance': 'TPO 外观', 'TPO structure': 'TPO 结构',
  'Periods per profile': '每个分布的周期数', 'Block size': '时间块大小', 'Row size': '每行价格跨度',
  'Ticks per row': '每行最小价格变动数', 'Value area (%)': '价值区域占比（%）', Display: '显示方式',
  Day: '日', Week: '周', Month: '月', Auto: '自动', Manual: '手动', Letters: '字母', Blocks: '色块',
  'Letters and blocks': '字母与色块', 'Gradient 1': '渐变色 1', 'Gradient 2': '渐变色 2',
  'Gradient 3': '渐变色 3', 'Gradient 4': '渐变色 4',
  'Outside value area opacity (%)': '价值区域外不透明度（%）', 'Split all sessions': '拆分所有交易时段',
  'Profile levels': '分布关键价位', 'POC color': 'POC 颜色', 'Extend POC right': '向右延伸 POC',
  'VAH color': 'VAH 颜色', 'Extend VAH right': '向右延伸 VAH', 'VAL color': 'VAL 颜色',
  'Extend VAL right': '向右延伸 VAL', 'Poor high / low': '未完成高点／低点',
  'Poor high / low color': '未完成高点／低点颜色', 'Single prints': '单列成交区',
  'Single prints color': '单列成交区颜色', Midpoint: '中点', 'Midpoint color': '中点颜色',
  'Session open': '时段开盘价', 'Session open color': '时段开盘价颜色',
  'Session close': '时段收盘价', 'Session close color': '时段收盘价颜色',
  'Initial balance': '初始平衡区间', 'Initial balance blocks': '初始平衡时间块数',
  'Initial balance color': '初始平衡区间颜色', 'Volume overlay': '成交量叠加',
  'Show volume profile': '显示成交量分布', 'Volume placement': '成交量显示位置',
  'Volume width (%)': '成交量宽度（%）', 'Volume color': '成交量颜色',
  'Volume values': '成交量数值', 'Volume values color': '成交量数值颜色',
  'Volume value area (%)': '成交量价值区域占比（%）', 'Volume value area color': '成交量价值区域颜色',
  'Volume overlay levels': '成交量关键价位', 'Volume POC': '成交量 POC', 'Volume POC color': '成交量 POC 颜色',
  'Volume VAH': '成交量 VAH', 'Volume VAH color': '成交量 VAH 颜色',
  'Volume VAL': '成交量 VAL', 'Volume VAL color': '成交量 VAL 颜色',
  'Volume appearance': '成交量外观', 'Volume calculation': '成交量计算', 'Width (%)': '宽度（%）',
  Placement: '位置', Left: '左侧', Right: '右侧', 'Values color': '数值颜色', 'Up / down': '上涨／下跌',
  Total: '合计', 'Delta (estimated)': 'Delta（估算）', 'Outside value area': '价值区域外',
  'Value area': '价值区域', 'Histogram box': '柱状图边框', 'Histogram box color': '柱状图边框颜色',
  'Developing POC': '动态 POC', 'Developing value area': '动态价值区域', 'Rows layout': '行布局',
  'Number of rows': '行数',
  'Open interest is unavailable for this instrument.': '该交易品种不提供持仓量。',
}

export function chartSettingsChinese(text: string): string {
  const minutes = /^(\d+) minutes$/.exec(text)
  if (minutes) return `${minutes[1]} 分钟`
  return labels[text] ?? chartSettingLabel(text)
}
