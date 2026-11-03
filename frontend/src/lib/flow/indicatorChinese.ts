import { INDICATOR_CATALOG } from './constants'

// Display translations only: indicator ids remain the API function names.
const translations: Record<string, string> = {
  alligator: '鳄鱼线', alma: '阿尔诺勒古移动平均线', ckstop: '钱德克罗尔止损',
  dema: '双重指数移动平均线', ema: '指数移动平均线', frama: '分形自适应移动平均线',
  hma: '赫尔移动平均线', ichimoku: '一目均衡表', kama: '考夫曼自适应移动平均线',
  ma_envelopes: '均线包络线', mcginley: '麦金利动态指标', sma: '简单移动平均线',
  supertrend: '超级趋势', t3: 'T3 移动平均线', tema: '三重指数移动平均线',
  trima: '三角移动平均线', vidya: '可变指数动态平均线', vwma: '成交量加权移动平均线',
  wma: '加权移动平均线', zlema: '零滞后指数移动平均线', apo: '绝对价格振荡器',
  bop: '多空力量平衡', cci: '商品通道指数', cmo: '钱德动量振荡器', crsi: '康纳斯相对强弱指数',
  dpo: '去趋势价格振荡器', elderray: '艾达射线', fisher: '费舍尔变换',
  macd: '指数平滑异同移动平均线', mom: '动量指标', po: '价格振荡器', ppo: '百分比价格振荡器',
  rsi: '相对强弱指数', stochastic: '随机指标', stochf: '快速随机指标', stochrsi: '随机相对强弱指标',
  trix: '三重指数平滑平均线', williams_r: '威廉指标', atr: '平均真实波幅', bbands: '布林带',
  bbpercent: '布林带百分比', bbwidth: '布林带宽度', chaikin: '蔡金波动率',
  chandelier_exit: '吊灯止损', donchian: '唐奇安通道', hv: '历史波动率', keltner: '肯特纳通道',
  massindex: '梅斯线', natr: '标准化平均真实波幅', rvi: '相对波动率指数', starc: 'STARC 波动通道',
  true_range: '真实波幅', ultimate_oscillator: '终极振荡器', uo_oscillator: '终极振荡器',
  adl: '累积派发线', cmf: '蔡金资金流', emv: '简易波动指标', force_index: '艾达力度指数',
  kvo: '克林格成交量振荡器', mfi: '资金流量指数', nvi: '负成交量指标',
  nvi_with_ema: '负成交量指标及指数均线', obv: '能量潮', obv_smoothed: '平滑能量潮',
  pvi: '正成交量指标', pvi_with_signal: '正成交量指标及信号线', pvt: '量价趋势',
  rvol: '相对成交量', volosc: '成交量振荡器', vroc: '成交量变化率', vwap: '成交量加权平均价',
  accelerator_oscillator: '加速振荡器', aroon_oscillator: '阿隆振荡器',
  awesome_oscillator: '动量震荡指标', cho: '蔡金振荡器', chop: '震荡指数', coppock: '科波克曲线',
  gator_oscillator: '鳄鱼振荡器', kst: '确定性指标', roc: '变动率', rocp: '变动百分比',
  rocr: '变动比率', rocr100: '百倍变动比率', stc: '沙夫趋势周期', tsi: '真实强弱指数',
  linreg: '线性回归', linregangle: '线性回归角度', linregintercept: '线性回归截距',
  lrslope: '线性回归斜率', median: '中位数', mode: '众数', tsf: '时间序列预测', variance: '方差',
  adx: '平均趋向指数', adxr: '平均趋向指数评级', aroon: '阿隆指标', dmi: '趋向指标',
  dx: '趋向指数', fractals: '分形指标', minus_dm: '负向变动', pivot_points: '枢轴点',
  plus_dm: '正向变动', psar: '抛物线转向指标', rwi: '随机游走指数', avgprice: '平均价格',
  medprice: '中间价格', midpoint: '区间中点', midprice: '价格区间中点', typprice: '典型价格',
  wclprice: '加权收盘价', change: '变化值', falling: '下跌判断', highest: '最高值',
  lowest: '最低值', rising: '上涨判断', stdev: '标准差',
}

export function flowIndicatorName(id: string): string {
  const item = INDICATOR_CATALOG.find((entry) => entry.value === id.toLowerCase())
  if (!item) return id
  const chinese = translations[item.value]
  return chinese ? `${item.label}（${chinese}）` : item.label
}

export function flowIndicatorCategory(category: string): string {
  return ({ Trend: '趋势', Momentum: '动量', Volatility: '波动率', Volume: '成交量',
    Oscillators: '振荡指标', Statistical: '统计', Hybrid: '综合',
    'Price Transform': '价格变换', Utility: '辅助' } as Record<string, string>)[category] ?? category
}
