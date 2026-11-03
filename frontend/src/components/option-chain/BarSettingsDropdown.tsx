import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BarDataSource, BarStyle } from '@/types/option-chain'

interface BarSettingsDropdownProps {
  barDataSource: BarDataSource
  barStyle: BarStyle
  onBarDataSourceChange: (source: BarDataSource) => void
  onBarStyleChange: (style: BarStyle) => void
}

export function BarSettingsDropdown({
  barDataSource,
  barStyle,
  onBarDataSourceChange,
  onBarStyleChange,
}: BarSettingsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <BarChart3 className="h-4 w-4" />
          <span className="sr-only">柱状图设置</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>柱状图数据</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={barDataSource}
          onValueChange={(v) => onBarDataSourceChange(v as BarDataSource)}
        >
          <DropdownMenuRadioItem value="oi">持仓量</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="volume">成交量</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>柱状图样式</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={barStyle}
          onValueChange={(v) => onBarStyleChange(v as BarStyle)}
        >
          <DropdownMenuRadioItem value="gradient">渐变</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="solid">纯色</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
