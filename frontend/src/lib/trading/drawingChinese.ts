/** Display labels only; drawing identifiers and generated metadata remain unchanged. */
const toolNames: Record<string, string> = {
  'trend-line': '趋势线', ray: '射线', 'extended-line': '延长线', arrow: '箭头',
  'info-line': '信息线', 'trend-angle': '趋势角度', 'horizontal-line': '水平线',
  'horizontal-ray': '水平射线', 'vertical-line': '垂直线', 'cross-line': '十字线',
  'parallel-channel': '平行通道', 'fib-channel': '斐波那契通道', 'disjoint-channel': '分离通道',
  'flat-top-bottom': '水平顶底通道', 'regression-channel': '回归通道', pitchfork: '安德鲁斯叉线',
  'schiff-pitchfork': '希夫叉线', 'modified-schiff-pitchfork': '修正希夫叉线', 'inside-pitchfork': '内部叉线',
  'fib-retracement': '斐波那契回撤', 'fib-extension': '斐波那契扩展', 'fib-time-zone': '斐波那契时间区间',
  'fib-fan': '斐波那契扇形线', 'fib-extension-two-point': '两点斐波那契扩展',
  'fib-speed-resistance-fan': '斐波那契速度阻力扇', 'trend-fib-time': '趋势斐波那契时间',
  'fib-circles': '斐波那契圆', 'fib-speed-resistance-arcs': '斐波那契速度阻力弧',
  'fib-wedge': '斐波那契楔形', 'fib-spiral': '斐波那契螺旋',
  'gann-fan': '江恩扇形线', 'gann-box': '江恩箱体', 'gann-square': '江恩正方形',
  rectangle: '矩形', 'rotated-rectangle': '旋转矩形', ellipse: '椭圆', circle: '圆形', triangle: '三角形',
  path: '路径', polyline: '折线', arc: '弧线', curve: '曲线', 'double-curve': '双曲线',
  'cyclic-lines': '周期线', 'time-cycles': '时间周期', 'sine-line': '正弦线',
  'xabcd-pattern': 'XABCD 形态', 'abcd-pattern': 'ABCD 形态', 'head-shoulders': '头肩形态',
  'elliott-impulse': '艾略特推动浪', 'elliott-correction': '艾略特调整浪',
  gartley: '加特利形态', bat: '蝙蝠形态', butterfly: '蝴蝶形态', crab: '螃蟹形态',
  shark: '鲨鱼形态', cypher: '赛弗形态', 'dedekind-tessellation': '戴德金镶嵌',
  sonic: '声波', supersonic: '超声波', 'golden-sonic': '黄金声波', 'golden-supersonic': '黄金超声波',
  'long-position': '多头持仓', 'short-position': '空头持仓', forecast: '预测',
  'anchored-vwap': '锚定成交量加权平均价（VWAP）', 'fixed-range-volume-profile': '固定区间成交量分布',
  'price-range': '价格区间', 'date-range': '日期区间', measure: '测量', text: '文本',
  'price-label': '价格标签', callout: '标注', note: '备注', balloon: '气泡', comment: '评论',
  'price-note': '价格备注', signpost: '指示牌', table: '表格', 'flag-mark': '旗标', 'icon-stamp': '图标标记',
  'arrow-up': '向上箭头', 'arrow-down': '向下箭头', 'arrow-left': '向左箭头', 'arrow-right': '向右箭头',
  brush: '画笔', highlighter: '荧光笔',
}

const groupNames: Record<string, string> = {
  Lines: '线条', 'Horizontal and vertical': '水平线与垂直线', Channels: '通道', Pitchforks: '叉线',
  'Fibonacci & Gann': '斐波那契与江恩', Fibonacci: '斐波那契', Gann: '江恩', Shapes: '形状',
  Paths: '路径', Cycles: '周期', Patterns: '形态', 'Patterns and waves': '形态与波浪',
  'Harmonic patterns': '谐波形态', 'Geometric studies': '几何研究', Forecasting: '预测与持仓',
  'Volume studies': '成交量分析', Measurers: '测量工具', 'Arrows & notes': '箭头与备注',
  'Text and notes': '文本与备注', Marks: '标记', Arrows: '箭头', Brushes: '画笔',
}

export function drawingToolName(id: string | null, fallback: string): string {
  return (id && toolNames[id]) || fallback
}

export function drawingGroupName(label: string): string {
  return groupNames[label] ?? label
}
