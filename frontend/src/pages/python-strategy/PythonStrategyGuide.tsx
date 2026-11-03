import { Link } from 'react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStrategyExchanges } from '@/hooks/useStrategyExchanges'
import { showToast } from '@/utils/toast'

const sampleStrategy = `"""
===============================================================================
                EMA CROSSOVER WITH FIXED DATETIME HANDLING
                            OpenAlgo Trading Bot
===============================================================================

Run standalone:
    export OPENALGO_API_KEY="your-api-key"
    python emacrossover_strategy_python.py

Run via OpenAlgo's /python strategy runner:
    OPENALGO_API_KEY            : injected per-strategy (PR #1247).
    OPENALGO_STRATEGY_EXCHANGE  : set from the strategy's \`exchange\` config
                                  (NSE / BSE / NFO / BFO / MCX / BCD / CDS / CRYPTO).
                                  Drives both this script's trading exchange and
                                  the host's calendar/holiday gating, so the two
                                  always agree.
    STRATEGY_ID / STRATEGY_NAME : injected for log/order tagging.
    HOST_SERVER / WEBSOCKET_URL : inherited from OpenAlgo's .env.
    No code changes required.
"""

import os
import threading
import time
from datetime import datetime, timedelta

import pandas as pd
from openalgo import api

# ===============================================================================
# TRADING CONFIGURATION
# ===============================================================================

# API Configuration — read from environment with sensible fallbacks.
# When launched via OpenAlgo's /python runner, these come from the platform:
#   OPENALGO_API_KEY : injected per-strategy (decrypted from DB)
#   HOST_SERVER      : inherited from OpenAlgo's .env
#   WEBSOCKET_URL    : inherited from OpenAlgo's .env
API_KEY = os.getenv("OPENALGO_API_KEY", "openalgo-apikey")
API_HOST = os.getenv("HOST_SERVER", "http://127.0.0.1:5000")
WS_URL = os.getenv("WEBSOCKET_URL", "ws://127.0.0.1:8765")

# Trade Settings
# EXCHANGE prefers OPENALGO_STRATEGY_EXCHANGE (set by /python runner from the
# strategy's config) so the script trades on whichever exchange the host is
# gating its calendar against. Falls back to EXCHANGE env var, then NSE.
SYMBOL = os.getenv("SYMBOL", "NHPC")              # Stock to trade
EXCHANGE = os.getenv(
    "OPENALGO_STRATEGY_EXCHANGE",
    os.getenv("EXCHANGE", "NSE"),
)                                                 # NSE, BSE, NFO, MCX, etc.
QUANTITY = int(os.getenv("QUANTITY", "1"))        # Number of shares
PRODUCT = os.getenv("PRODUCT", "MIS")             # MIS (Intraday) or CNC (Delivery)

# Strategy Parameters
FAST_EMA_PERIOD = int(os.getenv("FAST_EMA_PERIOD", "2"))
SLOW_EMA_PERIOD = int(os.getenv("SLOW_EMA_PERIOD", "4"))
CANDLE_TIMEFRAME = os.getenv("CANDLE_TIMEFRAME", "5m")

# Historical Data Lookback (1-30 days)
LOOKBACK_DAYS = int(os.getenv("LOOKBACK_DAYS", "3"))

# Risk Management (Rupees)
STOPLOSS = float(os.getenv("STOPLOSS", "0.1"))
TARGET = float(os.getenv("TARGET", "0.2"))

# Direction Control: LONG, SHORT, BOTH
TRADE_DIRECTION = os.getenv("TRADE_DIRECTION", "BOTH")

# Signal Check Interval (seconds)
SIGNAL_CHECK_INTERVAL = int(os.getenv("SIGNAL_CHECK_INTERVAL", "5"))

# ===============================================================================
# TRADING BOT
# ===============================================================================

class ConfigurableEMABot:
    def __init__(self):
        # Initialize API client
        self.client = api(
            api_key=API_KEY,
            host=API_HOST,
            ws_url=WS_URL,
        )

        # Position tracking
        self.position = None
        self.entry_price = 0
        self.stoploss_price = 0
        self.target_price = 0

        # Real-time price tracking
        self.ltp = None
        self.exit_in_progress = False

        # Thread control
        self.running = True
        self.stop_event = threading.Event()

        # Instrument for WebSocket
        self.instrument = [{"exchange": EXCHANGE, "symbol": SYMBOL}]

        # Strategy name from the platform
        self.strategy_name = os.getenv("STRATEGY_NAME", f"EMA_{TRADE_DIRECTION}")

        print(f"[BOT] Symbol: {SYMBOL} on {EXCHANGE}")
        print(f"[BOT] Strategy: {FAST_EMA_PERIOD} EMA x {SLOW_EMA_PERIOD} EMA")

    # =========================================================================
    # WEBSOCKET HANDLER — real-time SL/Target monitoring
    # =========================================================================

    def on_ltp_update(self, data):
        if data.get("type") == "market_data" and data.get("symbol") == SYMBOL:
            self.ltp = float(data["data"]["ltp"])

            if self.position and not self.exit_in_progress:
                # Check stoploss / target
                exit_reason = None
                if self.position == "BUY":
                    if self.ltp <= self.stoploss_price:
                        exit_reason = "STOPLOSS HIT"
                    elif self.ltp >= self.target_price:
                        exit_reason = "TARGET HIT"
                elif self.position == "SELL":
                    if self.ltp >= self.stoploss_price:
                        exit_reason = "STOPLOSS HIT"
                    elif self.ltp <= self.target_price:
                        exit_reason = "TARGET HIT"

                if exit_reason and not self.exit_in_progress:
                    self.exit_in_progress = True
                    threading.Thread(
                        target=self.place_exit_order, args=(exit_reason,)
                    ).start()

    def websocket_thread(self):
        try:
            self.client.connect()
            self.client.subscribe_ltp(
                self.instrument, on_data_received=self.on_ltp_update
            )
            while not self.stop_event.is_set():
                time.sleep(1)
        except Exception as e:
            print(f"[ERROR] WebSocket error: {e}")
        finally:
            try:
                self.client.unsubscribe_ltp(self.instrument)
                self.client.disconnect()
            except Exception:
                pass

    # =========================================================================
    # TRADING FUNCTIONS
    # =========================================================================

    def get_historical_data(self):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=LOOKBACK_DAYS)
        return self.client.history(
            symbol=SYMBOL,
            exchange=EXCHANGE,
            interval=CANDLE_TIMEFRAME,
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
        )

    def check_for_signal(self, data):
        if data is None or len(data) < SLOW_EMA_PERIOD + 2:
            return None

        data["fast_ema"] = data["close"].ewm(
            span=FAST_EMA_PERIOD, adjust=False
        ).mean()
        data["slow_ema"] = data["close"].ewm(
            span=SLOW_EMA_PERIOD, adjust=False
        ).mean()

        prev = data.iloc[-3]
        last = data.iloc[-2]

        # BUY: fast crosses above slow
        if prev["fast_ema"] <= prev["slow_ema"] and \\
           last["fast_ema"] > last["slow_ema"]:
            if TRADE_DIRECTION in ["LONG", "BOTH"]:
                return "BUY"
        # SELL: fast crosses below slow
        if prev["fast_ema"] >= prev["slow_ema"] and \\
           last["fast_ema"] < last["slow_ema"]:
            if TRADE_DIRECTION in ["SHORT", "BOTH"]:
                return "SELL"
        return None

    def place_entry_order(self, signal):
        response = self.client.placeorder(
            strategy=self.strategy_name,
            symbol=SYMBOL,
            exchange=EXCHANGE,
            action=signal,
            quantity=QUANTITY,
            price_type="MARKET",
            product=PRODUCT,
        )
        if response.get("status") == "success":
            # ... track position, set SL/target levels
            self.position = signal

    def place_exit_order(self, reason="Manual"):
        exit_action = "SELL" if self.position == "BUY" else "BUY"
        self.client.placeorder(
            strategy=self.strategy_name,
            symbol=SYMBOL,
            exchange=EXCHANGE,
            action=exit_action,
            quantity=QUANTITY,
            price_type="MARKET",
            product=PRODUCT,
        )
        self.position = None
        self.exit_in_progress = False

    # =========================================================================
    # MAIN LOOP
    # =========================================================================

    def run(self):
        # Start WebSocket thread for real-time SL/Target
        ws_thread = threading.Thread(target=self.websocket_thread, daemon=True)
        ws_thread.start()
        time.sleep(2)

        try:
            while self.running:
                if not self.position and not self.exit_in_progress:
                    data = self.get_historical_data()
                    signal = self.check_for_signal(data)
                    if signal:
                        self.place_entry_order(signal)
                time.sleep(SIGNAL_CHECK_INTERVAL)
        except KeyboardInterrupt:
            self.running = False
            self.stop_event.set()
            if self.position:
                self.place_exit_order("Bot Shutdown")

if __name__ == "__main__":
    bot = ConfigurableEMABot()
    bot.run()
`

const envVarsSnippet = `# API Configuration — auto-injected by the /python runner
API_KEY = os.getenv("OPENALGO_API_KEY", "openalgo-apikey")
API_HOST = os.getenv("HOST_SERVER", "http://127.0.0.1:5000")
WS_URL = os.getenv("WEBSOCKET_URL", "ws://127.0.0.1:8765")

# Exchange — reads OPENALGO_STRATEGY_EXCHANGE so your script
# trades on the same exchange the host gates its calendar against.
EXCHANGE = os.getenv(
    "OPENALGO_STRATEGY_EXCHANGE",
    os.getenv("EXCHANGE", "NSE"),
)

# Strategy identity (for tagging orders/logs)
STRATEGY_NAME = os.getenv("STRATEGY_NAME", "MyStrategy")
STRATEGY_ID = os.getenv("STRATEGY_ID", "")

# All custom parameters from the upload form are also available:
MY_PARAM = os.getenv("MY_PARAM", "default_value")`

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  showToast.success('已复制到剪贴板', 'clipboard')
}

export default function PythonStrategyGuide() {
  const { exchanges } = useStrategyExchanges()

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/python">&larr; Back to Python Strategies</Link>
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Python 策略指南</h1>
        <p className="text-muted-foreground">
          Self-host automated trading strategies inside OpenAlgo. Each strategy runs as an isolated
          subprocess with its own process, memory, and log file &mdash; managed through the{' '}
          <Link to="/python" className="text-primary hover:underline">
            /python
          </Link>{' '}
          dashboard.
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>快速开始</CardTitle>
          <CardDescription>5 分钟运行您的第一个策略</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex gap-4">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                1
              </Badge>
              <div>
                <p className="font-medium">安装 OpenAlgo SDK</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-sm">pip install openalgo</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('pip install openalgo')}
                  >
                    复制
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                2
              </Badge>
              <div>
                <p className="font-medium">获取 API 密钥</p>
                <p className="text-sm text-muted-foreground">
                  Go to{' '}
                  <Link to="/apikey" className="text-primary hover:underline">
                    API Key
                  </Link>{' '}
                  page and copy your OpenAlgo API key
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                3
              </Badge>
              <div>
                <p className="font-medium">编写策略</p>
                <p className="text-sm text-muted-foreground">
                  Create a Python file (.py) with your trading logic. Read configuration from
                  environment variables so it works both standalone and under the /python runner
                  without edits. See the sample strategy below.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                4
              </Badge>
              <div>
                <p className="font-medium">上传并配置</p>
                <p className="text-sm text-muted-foreground">
                  On the{' '}
                  <Link to="/python" className="text-primary hover:underline">Python 策略</Link>{' '}
                  page, click <strong>添加策略</strong>. Pick a name, select the exchange (NSE /
                  MCX / CRYPTO / etc.), and add any custom parameters as environment variables.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                5
              </Badge>
              <div>
                <p className="font-medium">启动或排程</p>
                <p className="text-sm text-muted-foreground">
                  Click <strong>启动</strong> to run immediately, or configure a schedule (e.g.
                  09:15&ndash;15:30 Mon&ndash;Fri for NSE). The host auto-starts and auto-stops your
                  strategy at the scheduled times, respecting the exchange's holiday calendar.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>工作原理</CardTitle>
          <CardDescription>进程隔离、环境变量注入与交易所日历调度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">进程隔离</p>
              <p className="text-muted-foreground">
                每个策略都作为独立的 <code>subprocess.Popen</code> 进程运行，拥有独立的进程 ID、内存和文件描述符。一个策略崩溃不会影响其他策略或主程序。
              </p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">环境变量注入</p>
              <p className="text-muted-foreground">
                主程序向每个策略注入 <code>OPENALGO_API_KEY</code>、<code>STRATEGY_ID</code>、
                <code>STRATEGY_NAME</code> 和 <code>OPENALGO_STRATEGY_EXCHANGE</code>。策略还会继承
                <code>.env</code> 中的变量（如 <code>HOST_SERVER</code> 和 <code>WEBSOCKET_URL</code>），
                上传表单中的自定义参数也会成为环境变量。
              </p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">按交易所选择交易日历</p>
              <p className="text-muted-foreground">
                每个策略关联一个交易所，主程序根据该交易所的假日历控制定时启动和停止。
                NSE 休市而 MCX 夜盘开市时，MCX 策略仍会运行；CRYPTO 策略不受假日影响。
              </p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">日志</p>
              <p className="text-muted-foreground">
                所有 <code>print()</code> 输出都会写入 <code>log/strategies/</code> 下带时间戳的日志文件。
                可从仪表盘或各策略卡片上的日志按钮查看。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>环境变量</CardTitle>
          <CardDescription>策略脚本中可用的变量</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="font-medium mb-2">由平台注入</p>
            <p className="text-sm text-muted-foreground mb-3">以下环境变量由 /python 运行器直接设置到每个策略子进程：</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">变量</th>
                    <th className="text-left py-2 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>OPENALGO_API_KEY</code>
                    </td>
                    <td className="py-2">该用户解密后的 API 密钥</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>STRATEGY_ID</code>
                    </td>
                    <td className="py-2">此策略的唯一标识符</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>STRATEGY_NAME</code>
                    </td>
                    <td className="py-2">策略名称（上传时填写）</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>OPENALGO_STRATEGY_EXCHANGE</code>
                    </td>
                    <td className="py-2">
                      上传或编辑时选择的交易所（NSE / BSE / NFO / BFO / MCX / BCD / CDS / CRYPTO）。读取此变量，使交易请求与主程序使用的交易日历保持一致。
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>OPENALGO_HOST</code>
                    </td>
                    <td className="py-2">
                      备用地址（<code>http://127.0.0.1:5000</code>）。建议优先使用 <code>HOST_SERVER</code>。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">继承自 .env</p>
            <p className="text-sm text-muted-foreground mb-3">
              策略通过 <code>os.environ.copy()</code> 继承 OpenAlgo 的 <code>.env</code> 中的所有变量。连接 OpenAlgo 时常用的变量如下：
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">变量</th>
                    <th className="text-left py-2 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>HOST_SERVER</code>
                    </td>
                    <td className="py-2">
                      REST 服务地址，例如 <code>http://127.0.0.1:5000</code>。这是 <code>.env</code> 中的标准变量，建议在脚本中优先使用。
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>WEBSOCKET_URL</code>
                    </td>
                    <td className="py-2">
                      完整 WebSocket 地址，例如 <code>ws://127.0.0.1:8765</code>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>WEBSOCKET_HOST</code>
                    </td>
                    <td className="py-2">WebSocket 主机部分，例如<code>127.0.0.1</code>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>WEBSOCKET_PORT</code>
                    </td>
                    <td className="py-2">
                      WebSocket 端口，例如 <code>8765</code>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      <code>FLASK_HOST_IP</code> / <code>FLASK_PORT</code>
                    </td>
                    <td className="py-2">
                      Flask 绑定地址（需要单独的地址或端口时使用）
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">脚本中的推荐写法</p>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => copyToClipboard(envVarsSnippet)}
              >
                复制
              </Button>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{envVarsSnippet}</code>
              </pre>
            </div>
          </div>

          <Alert>
            <AlertTitle>强烈建议读取 OPENALGO_STRATEGY_EXCHANGE</AlertTitle>
            <AlertDescription>
              如果脚本将 <code>exchange = "NSE"</code> 写死，主程序仍按配置的交易所日历运行（例如配置 <code>exchange=MCX</code> 时在 MCX 夜盘运行），但 <code>client.placeorder(exchange="NSE", ...)</code> 仍会发送 NSE 订单，可能被交易商拒绝。使用环境变量可使交易日历与脚本订单保持一致。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Exchange-Aware Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>按交易所安排运行时间</CardTitle>
          <CardDescription>
            主程序根据策略所属交易所选择假日历
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              上传或编辑策略时需选择交易所。主程序根据该交易所的日历决定每天是否启动或停止策略：
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              <li>
                如果 MCX 开市，<strong>MCX</strong> 策略会在 NSE/BSE 假日继续运行。
              </li>
              <li>
                <strong>CRYPTO</strong> 策略不受节假日或周末限制，全天候运行。
              </li>
              <li>
                <strong>SPECIAL_SESSION</strong> 特别交易时段（如 Muhurat、灾备演练）可覆盖对应交易所的周末限制。
              </li>
            </ul>
          </div>

          <div>
            <p className="font-medium mb-2">支持的交易所</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {exchanges.map((opt) => (
                <div key={opt.value} className="bg-muted p-2 rounded">
                  <strong>{opt.value}</strong>
                  {opt.description ? ` — ${opt.description}` : ''}
                  {opt.window ? ` (${opt.window})` : ''}
                  {opt.is_24x7 ? '（无休市日）' : ''}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              交易时段实时读取市场日历数据库，交易所时间变更（例如期货和期权收盘改为 15:40）会自动显示。单日特殊安排（部分休市、特别交易时段）也由该数据库提供，并由调度器应用。
            </p>
          </div>

          <div>
            <p className="font-medium mb-2">计划时间交集规则</p>
            <p className="text-sm text-muted-foreground mb-3">
              有效交易时段是策略 <code>start..stop</code> 时间与交易所在该日期的交易时段的<strong>交集</strong>。
            </p>
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <p>
                <strong>示例：</strong> MCX 策略计划运行时间为 09:15&ndash;23:55
              </p>
              <p className="text-muted-foreground">
                2026 年 4 月 14 日（安贝德卡诞辰），MCX 部分休市，夜盘时间为 17:00&ndash;23:55。有效运行时段为两者的交集 <strong>17:00&ndash;23:55</strong>。部分休市时无需修改计划。
              </p>
            </div>
          </div>

          <div>
            <p className="font-medium mb-3">实际示例</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium">场景</th>
                    <th className="text-left py-2 pr-3 font-medium">交易所</th>
                    <th className="text-left py-2 font-medium">策略行为</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-3" rowSpan={3}>
                      <strong>14-Apr-2026</strong>
                      <br />
                      <span className="text-xs">安贝德卡诞辰</span>
                    </td>
                    <td className="py-2 pr-3">NSE / BSE / NFO</td>
                    <td className="py-2">全天休市。策略在印度标准时间 00:01 暂停</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3">MCX</td>
                    <td className="py-2">
                      开市时间为 17:00&ndash;23:55，MCX 策略在 17:00 自动启动。
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3">CRYPTO</td>
                    <td className="py-2">不受影响（全天候）</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3" rowSpan={3}>
                      <strong>8-Nov-2026</strong>
                      <br />
                      <span className="text-xs">周日排灯节 Muhurat 交易</span>
                    </td>
                    <td className="py-2 pr-3">NSE / BSE / NFO</td>
                    <td className="py-2">
                      特别交易时段 14:20&ndash;15:30（NFO 至 15:40）。尽管是周日，策略仍只在该时段运行。
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3">MCX</td>
                    <td className="py-2">SPECIAL_SESSION 14:20&ndash;15:30</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-3">CRYPTO</td>
                    <td className="py-2">不受影响（全天候）</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-medium mb-2">宿主如何控制策略运行</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="bg-muted p-3 rounded-lg">
                <strong>1. 定时任务</strong> &mdash; 在 <code>schedule_days</code> 指定的每一天，于 <code>start_time</code> 触发 <code>start_&lt;sid&gt;</code>。
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <strong>2. 每日检查（印度标准时间 00:01）</strong> &mdash; 对每个已排程策略查询 <code>get_market_status(config["exchange"])</code>。如果交易所当天休市，则停止策略并标记 <code>paused_reason=holiday|weekend</code>。
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <strong>3. 每分钟检查</strong> &mdash; 对每个策略执行相同检查。交易所重新开市或特别交易时段开始时，先前暂停的策略会自动恢复，但手动停止的策略（<code>manually_stopped</code>）除外。
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg text-sm">
            <p className="font-medium text-primary">上传时的智能默认值</p>
            <p className="text-muted-foreground mt-1">
              选择交易所后会自动填入默认计划：CRYPTO 为每周七天 00:00&ndash;23:59；MCX 为工作日 09:00&ndash;23:55；股票交易所为周一至周五 09:15&ndash;15:30。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sample Strategy */}
      <Card>
        <CardHeader>
          <CardTitle>策略示例：EMA（指数移动平均线）交叉</CardTitle>
          <CardDescription>
            由 WebSocket 驱动的 EMA（指数移动平均线）交叉策略，实时监控止损和目标价。所有配置均可通过环境变量覆盖；无需修改即可独立运行或通过 /python 运行器运行。完整版本位于 <code>examples/python/emacrossover_strategy_python.py</code>。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={() => copyToClipboard(sampleStrategy)}
            >
              复制
            </Button>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-[32rem] overflow-y-auto">
              <code>{sampleStrategy}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>常见问题</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="logs">
              <AccordionTrigger>如何查看策略日志？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>
                  所有 <code>print()</code> 语句的输出都会记录到日志文件。
                </p>
                <p>查看日志：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    点击策略卡片上的<strong>日志</strong>按钮。
                  </li>
                  <li>从列表选择日志文件（最新的在前）</li>
                  <li>
                    启用<strong>自动刷新</strong>，可在运行时查看实时更新。
                  </li>
                </ol>
                <p className="text-sm">
                  日志保存在 <code>log/strategies/</code>。每个策略最多保留 {'{'}STRATEGY_LOG_MAX_FILES{'}'} 个文件，总大小不超过 {'{'}STRATEGY_LOG_MAX_SIZE_MB{'}'} MB，保留 {'{'}STRATEGY_LOG_RETENTION_DAYS{'}'} 天。可在 <code>.env</code> 中调整。
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scheduling">
              <AccordionTrigger>调度计划如何工作？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>每个策略都有调度计划，用于控制主程序何时自动启动和停止策略。</p>

                <div className="space-y-2">
                  <p className="font-medium">计划配置：</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>交易所：</strong>决定使用哪个假日历（NSE / MCX / CRYPTO 等）
                    </li>
                    <li>
                      <strong>开始时间：</strong>策略自动启动时间（印度标准时间，24 小时制）
                    </li>
                    <li>
                      <strong>结束时间：</strong>策略自动停止时间（印度标准时间，24 小时制）
                    </li>
                    <li>
                      <strong>日期：</strong>运行日期（可包含特别交易时段所在的周末）
                    </li>
                  </ul>
                </div>

                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <p className="font-medium">计划示例：</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>NSE EMA（指数移动平均线）策略：周一至周五 09:15&ndash;15:30</li>
                    <li>MCX 夜盘策略：周一至周五 17:00&ndash;23:55</li>
                    <li>CRYPTO 套利策略：每周七天 00:00&ndash;23:59</li>
                  </ul>
                </div>

                <Alert>
                  <AlertTitle>节假日与周末保护</AlertTitle>
                  <AlertDescription>
                    启动前会检查策略所属交易所的日历。NSE 假日即使有计划也不会启动 NSE 策略。周末策略默认不运行，除非日历中对应交易所和日期有 SPECIAL_SESSION 特别交易时段，或交易所为全天候开放的 CRYPTO。
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="status-indicators">
              <AccordionTrigger>状态标识是什么意思？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>每个策略会显示当前状态标签：</p>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge className="bg-green-500 text-white">运行中</Badge>
                    <span className="text-sm">策略正在运行并执行交易</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge className="bg-blue-500 text-white">已排程</Badge>
                    <div className="text-sm">
                      <p>策略正在等待，将在计划时间自动启动</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        例如：“今天印度标准时间 9:15 启动”或“下次：周一、周二印度标准时间 9:15”。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge className="bg-orange-500 text-white">手动停止</Badge>
                    <span className="text-sm">
                      策略已手动停止，点击启动之前不会自动运行。
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge className="bg-yellow-500 text-white">已暂停</Badge>
                    <span className="text-sm">策略因所属交易所休市而暂停</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge className="bg-red-500 text-white">错误</Badge>
                    <span className="text-sm">策略遇到错误并崩溃</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="start-stop">
              <AccordionTrigger>启动和停止如何工作？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                  <p className="font-medium text-green-600">启动按钮</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mt-2 text-sm">
                    <li>
                      <strong>计划时间内：</strong>策略立即开始运行</li>
                    <li>
                      <strong>计划时间之外：</strong>策略等待运行，状态变为“已排程”。
                    </li>
                    <li>
                      安排调度后，按钮变为<strong>取消</strong>。
                    </li>
                  </ul>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                  <p className="font-medium text-red-600">停止按钮（运行中）</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mt-2 text-sm">
                    <li>停止运行中的策略进程（SIGTERM）</li>
                    <li>设置手动停止标记，策略不会自动启动</li>
                    <li>状态显示为“手动停止”</li>
                  </ul>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                  <p className="font-medium text-orange-600">取消按钮（已排程时）</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mt-2 text-sm">
                    <li>取消计划中的自动启动</li>
                    <li>设置手动停止标记</li>
                    <li>再次点击启动以重新安排计划</li>
                  </ul>
                </div>

                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="font-medium">使用场景</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                    <li>
                      <strong>晚间设置：</strong>晚上点击启动，策略于次日上午 9:15 运行</li>
                    <li>
                      <strong>休假模式：</strong>点击停止后，策略保持停止，直到您再次操作</li>
                    <li>
                      <strong>测试：</strong>修改调度计划以立即测试，测试后再改回</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="special-sessions">
              <AccordionTrigger>
                如何处理特别交易时段（如 Muhurat、预算日）？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>交易所偶尔会在节假日或周末安排特别交易时段，交易所日历会自动处理：</p>

                <div className="space-y-2 text-sm">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">自动处理（推荐）</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                      <li>
                        前往{' '}
                        <Link to="/admin/holidays" className="text-primary hover:underline">
                          管理 &rarr; 假日
                        </Link>
                      </li>
                      <li>
                        为对应日期和交易所添加 <strong>SPECIAL_SESSION</strong> 记录并填写交易时间（例如 Muhurat：NSE 14:20&ndash;15:30）。
                      </li>
                      <li>
                        确保策略的 <code>schedule_days</code> 包含对应的周六或周日。
                      </li>
                      <li>
                        主程序会在特别交易时段内自动启动策略，无需修改计划或事后改回。
                      </li>
                    </ol>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">手动覆盖</p>
                    <p className="mt-1">请在交易开始前登录 OpenAlgo，等待主合约下载完成，然后手动点击<strong>启动</strong>。交易时段结束时点击<strong>停止</strong>。</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="master-contract">
              <AccordionTrigger>为什么策略需要主合约？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>主合约包含交易商所需的交易品种映射。主合约下载完成后，策略才能启动。</p>
                <p>以下操作会自动下载主合约：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>登录 OpenAlgo</li>
                  <li>等待下载完成（状态显示在页面顶部）</li>
                </ol>
                <p className="text-sm">
                  如果看到“等待主合约”，请在登录后稍候。
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="resource-limits">
              <AccordionTrigger>是否有资源限制？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>在 Linux/macOS 上，每个策略的资源限制可防止异常脚本导致 OpenAlgo 崩溃；Windows 不在操作系统层面强制执行这些限制。</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">资源</th>
                        <th className="text-left py-2 pr-4 font-medium">默认限制</th>
                        <th className="text-left py-2 font-medium">覆盖设置（.env）</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 pr-4">虚拟内存</td>
                        <td className="py-2 pr-4">1024 MB</td>
                        <td className="py-2">
                          <code>STRATEGY_MEMORY_LIMIT_MB</code>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">CPU 时间（累计）</td>
                        <td className="py-2 pr-4">3600 秒</td>
                        <td className="py-2">硬编码</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">打开的文件描述符</td>
                        <td className="py-2 pr-4">256</td>
                        <td className="py-2">硬编码</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">最大进程数</td>
                        <td className="py-2 pr-4">256</td>
                        <td className="py-2">硬编码</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">每个策略的日志文件数</td>
                        <td className="py-2 pr-4">10 个文件</td>
                        <td className="py-2">
                          <code>STRATEGY_LOG_MAX_FILES</code>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">每个策略的日志大小</td>
                        <td className="py-2 pr-4">50 MB</td>
                        <td className="py-2">
                          <code>STRATEGY_LOG_MAX_SIZE_MB</code>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">日志保留时间</td>
                        <td className="py-2 pr-4">7 天</td>
                        <td className="py-2">
                          <code>STRATEGY_LOG_RETENTION_DAYS</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm">
                  典型的 EMA（指数移动平均线）交叉策略使用 80&ndash;120 MB 内存和 5&ndash;10 个文件描述符。默认限制较宽裕；简单策略可将内存限制降至 256&ndash;512 MB，以便同时运行更多策略。
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="restart">
              <AccordionTrigger>重启 OpenAlgo 后会发生什么？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>OpenAlgo 重启后的处理方式：</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>策略配置保存在磁盘上并持续保留</li>
                  <li>所有策略的计划都会自动重新创建</li>
                  <li>启动时会清除过期的“运行中”标记</li>
                  <li>策略会在下一个计划时间自动启动</li>
                </ul>

                <Alert>
                  <AlertTitle>手动停止状态会保留</AlertTitle>
                  <AlertDescription>
                    如果重启前手动停止了策略，重启后仍会保持停止。<code>manually_stopped</code> 标记会保留，在点击启动前策略不会自动运行。
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="migration">
              <AccordionTrigger>升级到支持交易所日历的 /python 后需要做什么？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  <strong>无需迁移数据。</strong>升级后首次重启时，<code>load_configs()</code> 会为缺少该字段的旧配置写入 <code>"exchange": "NSE"</code>。
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>升级不会强制重启或停止策略</li>
                  <li>旧策略继续按 NSE 日历控制运行</li>
                  <li>
                    交易 MCX/CRYPTO 的策略需要在界面<strong>修改一次</strong>：进入计划，选择正确的交易所并保存。
                  </li>
                  <li>
                    <code>manually_stopped</code>策略会保持手动停止状态</li>
                  <li>
                    回滚到旧代码时会忽略新增的 <code>exchange</code> 字段，保持向前兼容。
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="best-practices">
              <AccordionTrigger>编写策略的最佳实践</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>
                    <strong>从环境变量读取配置</strong> &mdash; 使用 <code>os.getenv()</code> 并设置合理的备用值，使脚本既能独立运行，也能通过 /python 运行器运行。
                  </li>
                  <li>
                    <strong>读取 OPENALGO_STRATEGY_EXCHANGE</strong> &mdash; 使用主程序传入的交易所，使订单与交易日历一致。
                  </li>
                  <li>
                    <strong>使用 print() 记录日志</strong> &mdash; 输出会写入日志文件。
                  </li>
                  <li>
                    <strong>处理异常</strong> &mdash; 用 try/except 包裹关键代码。
                  </li>
                  <li>
                    <strong>添加休眠间隔</strong> &mdash; 使用 <code>time.sleep()</code>，避免过于频繁地调用 API。
                  </li>
                  <li>
                    <strong>处理中断</strong> &mdash; 主程序发送 SIGTERM 停止策略；请在处理程序中处理未平仓持仓。
                  </li>
                  <li>
                    <strong>使用小数量测试</strong> &mdash; 从 1 股或 1 手开始。
                  </li>
                  <li>
                    <strong>初期观察日志</strong> &mdash; 密切关注前几次运行情况。
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="add-libraries">
              <AccordionTrigger>如何添加 TA-Lib、pandas-ta 等库？</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  如果策略需要额外的 Python 库，请将其安装到 OpenAlgo 的运行环境中。
                </p>

                <div className="space-y-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium mb-2">使用 UV（推荐）</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                      <li>
                        打开 <code>pyproject.toml</code>，将所需库添加到 <code>dependencies</code> 部分。
                      </li>
                      <li>
                        在 OpenAlgo 目录中运行 <code>uv sync</code>。
                      </li>
                      <li>重启 OpenAlgo</li>
                    </ol>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium mb-2">使用常规 Python venv</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                      <li>
                        将所需库添加到 <code>requirements.txt</code>。
                      </li>
                      <li>激活虚拟环境并运行<code>pip install -r requirements.txt</code>
                      </li>
                      <li>重启 OpenAlgo</li>
                    </ol>
                  </div>
                </div>

                <Alert>
                  <AlertTitle>TA-Lib 安装说明</AlertTitle>
                  <AlertDescription>
                    TA-Lib 需要先安装底层 C 库。在 Mac 上运行：{' '}
                    <code>brew install ta-lib</code>
                    {' | '}
                    在 Ubuntu 上运行：<code>sudo apt-get install libta-lib-dev</code>
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="troubleshooting">
              <AccordionTrigger>常见问题排查</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">
                      部分休市日策略没有运行（例如 NSE 假日的 MCX 夜盘）
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
                      <li>
                        打开策略的计划设置，确认<strong>交易所</strong>已设置为正确的市场（旧策略默认为 NSE）。
                      </li>
                      <li>
                        确认“管理 → 假日”中该日期有对应交易所的部分开市时段记录。
                      </li>
                      <li>
                        确认您的计划与交易日历时段有重叠，实际运行时间是两者的交集。
                      </li>
                    </ul>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">
                      策略运行时订单因“市场已关闭”被拒绝
                    </p>
                    <p className="mt-1">
                      脚本中写死的 <code>exchange="NSE"</code> 与主程序的 <code>exchange="MCX"</code> 不一致。请在脚本中读取 <code>OPENALGO_STRATEGY_EXCHANGE</code>（参见上方环境变量说明）。
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">策略意外在周末运行</p>
                    <p className="mt-1">
                      这是预期行为：日历中的 SPECIAL_SESSION 记录会覆盖周末限制。如不希望运行，请从 <code>schedule_days</code> 中移除周六和周日。
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">策略因 MemoryError 而崩溃</p>
                    <p className="mt-1">策略超出单策略内存限制。请检查策略是否加载了大型数据集，在 <code>.env</code> 中适当提高 <code>STRATEGY_MEMORY_LIMIT_MB</code>，或优化内存使用。
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium">未设置 OPENALGO_API_KEY</p>
                    <p className="mt-1">
                      请确认已在{' '}
                      <Link to="/apikey" className="text-primary hover:underline">
                        API 密钥
                      </Link>
                      页面生成密钥。/python 运行器会从数据库自动注入密钥。
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* SDK Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>OpenAlgo SDK 快速参考</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">初始化客户端</p>
              <code className="text-xs">
                {'client = api(api_key=API_KEY, host=API_HOST, ws_url=WS_URL)'}
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">下单</p>
              <code className="text-xs">
                {
                  'client.placeorder(strategy, symbol, exchange, action, quantity, price_type, product)'
                }
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">历史数据</p>
              <code className="text-xs">
                {'client.history(symbol, exchange, interval, start_date, end_date)'}
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">WebSocket（最新价）</p>
              <code className="text-xs">
                {'client.connect(); client.subscribe_ltp(instruments, on_data_received=callback)'}
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">获取行情</p>
              <code className="text-xs">{'client.quotes(symbol="RELIANCE", exchange="NSE")'}</code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">委托状态</p>
              <code className="text-xs">
                {'client.orderstatus(order_id=order_id, strategy=strategy_name)'}
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">持仓 / 资产</p>
              <code className="text-xs">{'client.positionbook()  |  client.holdings()'}</code>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            完整的 SDK 文档请访问：{' '}
            <a
              href="https://docs.openalgo.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              docs.openalgo.in
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Directory Structure */}
      <Card>
        <CardHeader>
          <CardTitle>目录结构</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{`strategies/
  scripts/          # Uploaded strategy files
  examples/         # Example strategies
  configs.json      # Strategy configurations (atomic write)
  README.md         # Detailed documentation
  RESOURCE_LIMITS.md

log/
  strategies/       # Strategy log files (per-strategy rotation)

examples/
  python/           # Standalone example scripts
    emacrossover_strategy_python.py  # Full EMA crossover sample`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
