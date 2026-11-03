import { AlertTriangle, BookOpen, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { JsonEditor } from '@/components/ui/json-editor'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import { showToast } from '@/utils/toast'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  token: string
}

// EXCHANGES and PRODUCTS are now dynamic — provided by useSupportedExchanges() hook

const PRODUCTS = [
  { value: 'MIS', label: 'MIS - Intraday' },
  { value: 'NRML', label: 'NRML - Carry Forward' },
  { value: 'CNC', label: 'CNC - Delivery' },
]

export default function TradingView() {
  const { tradingExchanges, defaultExchange, isCrypto } = useSupportedExchanges()

  // Form state
  const [alertMode, setAlertMode] = useState<'strategy' | 'line'>('strategy')
  const [symbol, setSymbol] = useState(isCrypto ? 'BTCUSDFUT' : 'NHPC')
  const [exchange, setExchange] = useState(defaultExchange)
  const [product, setProduct] = useState(isCrypto ? 'NRML' : 'MIS')
  const [action, setAction] = useState('BUY')
  const [quantity, setQuantity] = useState('1')

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Re-sync exchange when broker capabilities load asynchronously
  useEffect(() => {
    setExchange((prev) =>
      prev && tradingExchanges.some((ex) => ex.value === prev) ? prev : defaultExchange
    )
  }, [defaultExchange, tradingExchanges])

  // JSON output
  const [generatedJson, setGeneratedJson] = useState<string>('')

  // API key state
  const [apiKey, setApiKey] = useState<string>('')

  // Host config state for webhook URL
  const [hostConfig, setHostConfig] = useState<{
    host_server: string
    is_localhost: boolean
  } | null>(null)

  // Refs
  const inputWrapperRef = useRef<HTMLDivElement>(null)

  // Fetch host configuration and API key on mount
  useEffect(() => {
    const fetchHostConfig = async () => {
      try {
        const response = await fetch('/api/config/host', { credentials: 'include' })
        const data = await response.json()
        setHostConfig(data)
      } catch (_error) {
        // Fallback to window.location.origin if config fetch fails
        setHostConfig({
          host_server: window.location.origin,
          is_localhost:
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        })
      }
    }
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/playground/api-key', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setApiKey(data.api_key || '')
        }
      } catch {
        // Silently fail - API key may not exist yet
      }
    }
    fetchHostConfig()
    fetchApiKey()
  }, [])

  // Get webhook URL from host config or fallback to window.location.origin
  const endpoint = alertMode === 'strategy' ? '/api/v1/placesmartorder' : '/api/v1/placeorder'
  const webhookUrl = hostConfig
    ? `${hostConfig.host_server}${endpoint}`
    : `${window.location.origin}${endpoint}`

  // Debounced search
  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        if (exchange) params.append('exchange', exchange)

        const response = await fetch(`/search/api/search?${params}`, {
          credentials: 'include',
        })
        const data = await response.json()
        setSearchResults((data.results || []).slice(0, 10))
        setShowResults(true)
      } catch (_error) {
        setSearchResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [exchange]
  )

  // Debounced input handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (symbol.length >= 2) {
        performSearch(symbol)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [symbol, performSearch])

  // Click-outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    setSymbol(result.symbol)
    setExchange(result.exchange)
    setShowResults(false)
  }

  const generateJson = useCallback((showError = true) => {
    if (!symbol || !exchange) {
      if (showError) {
        showToast.error('请选择交易品种和交易所', 'clipboard')
      }
      return
    }

    let json: Record<string, unknown>

    if (alertMode === 'strategy') {
      // Strategy Alert mode - uses {{strategy.order.action}} placeholder
      json = {
        apikey: apiKey || 'YOUR_API_KEY',
        strategy: 'TradingView Strategy',
        symbol: symbol,
        exchange: exchange,
        action: '{{strategy.order.action}}',
        product: product,
        pricetype: 'MARKET',
        quantity: '{{strategy.order.contracts}}',
        position_size: '{{strategy.position_size}}',
      }
    } else {
      // Line Alert mode - uses fixed action and quantity
      json = {
        apikey: apiKey || 'YOUR_API_KEY',
        strategy: 'TradingView Line Alert',
        symbol: symbol,
        exchange: exchange,
        action: action,
        product: product,
        pricetype: 'MARKET',
        quantity: quantity,
      }
    }

    setGeneratedJson(JSON.stringify(json, null, 2))
  }, [symbol, exchange, apiKey, alertMode, product, action, quantity])

  // Auto-generate JSON when values change
  useEffect(() => {
    generateJson(false)
  }, [generateJson])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast.success(`${label} copied to clipboard`, 'clipboard')
    } catch {
      showToast.error('复制失败，请手动复制', 'clipboard')
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">TradingView 配置</h1>
        <p className="text-muted-foreground mt-2">为 TradingView 策略提醒生成 Webhook 配置</p>
      </div>

      {/* Localhost Warning - only show if HOST_SERVER is not configured to external URL */}
      {hostConfig?.is_localhost && (
        <Alert variant="destructive" className="mb-8">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <strong>无法访问 Webhook 地址！</strong> TradingView 无法向本机地址发送提醒。请使用 <strong>ngrok</strong>、<strong>Cloudflare Tunnel</strong>、<strong>VS Code Dev Tunnel</strong> 或<strong>自定义域名</strong>使 OpenAlgo 可从外网访问，并将外网地址填入 <code>.env</code> 文件中的 <code>HOST_SERVER</code>。
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Webhook URL Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Webhook URL</CardTitle>
              <CardDescription>在 TradingView 提醒中使用此地址</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <code className="flex-1 text-sm font-mono truncate" title={webhookUrl}>
                  {webhookUrl}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle>配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Selector */}
              <Tabs value={alertMode} onValueChange={(v) => setAlertMode(v as 'strategy' | 'line')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="strategy">策略提醒</TabsTrigger>
                  <TabsTrigger value="line">线条提醒</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Symbol Search */}
              <div className="space-y-2">
                <Label htmlFor="symbol">交易品种</Label>
                <div className="relative" ref={inputWrapperRef}>
                  <Input
                    id="symbol"
                    type="text"
                    placeholder="搜索交易品种..."
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    onFocus={() => {
                      if (symbol.length >= 2) setShowResults(true)
                    }}
                    autoComplete="off"
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    </div>
                  )}

                  {/* Autocomplete Results */}
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer"
                          onClick={() => handleResultClick(result)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{result.symbol}</div>
                              <div className="text-xs text-muted-foreground">{result.name}</div>
                            </div>
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                              {result.exchange}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Exchange */}
              <div className="space-y-2">
                <Label htmlFor="exchange">交易所</Label>
                <Select value={exchange} onValueChange={setExchange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择交易所" />
                  </SelectTrigger>
                  <SelectContent>
                    {tradingExchanges.map((ex) => (
                      <SelectItem key={ex.value} value={ex.value}>
                        {ex.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Type (hidden for crypto — Delta Exchange ignores it) */}
              {!isCrypto && (
                <div className="space-y-2">
                  <Label htmlFor="product">产品类型</Label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Line Alert Mode Fields */}
              {alertMode === 'line' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="action">操作</Label>
                    <Select value={action} onValueChange={setAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUY">BUY</SelectItem>
                        <SelectItem value="SELL">SELL（卖出）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">数量</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="输入数量"
                    />
                  </div>
                </>
              )}

              {/* Generate Button */}
              <Button onClick={() => generateJson()} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />生成 JSON</Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Output */}
        <div className="space-y-6">
          {/* JSON Output */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>生成的 JSON</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(generatedJson, 'JSON')}
                  disabled={!generatedJson}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border bg-background h-64">
                {generatedJson ? (
                  <JsonEditor value={generatedJson} readOnly className="h-full" />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Fill in the form and click "Generate JSON" to see the output</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documentation Card */}
          <Card className="bg-accent text-accent-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                需要帮助？
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>通过分步指南了解如何使用 TradingView Webhook 设置自动交易。</p>
              <Button asChild variant="default">
                <a
                  href="https://docs.openalgo.in/trading-platform/tradingview"
                  target="_blank"
                  rel="noopener noreferrer"
                >查看文档<ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
