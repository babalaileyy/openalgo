import { Handle, Position } from '@xyflow/react'
import { Radio } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { SubscribeLTPNodeData } from '@/types/flow'

interface SubscribeLTPNodeProps {
  data: SubscribeLTPNodeData
  selected?: boolean
}

export const SubscribeLTPNode = memo(({ data, selected }: SubscribeLTPNodeProps) => {
  return (
    <div className={cn('workflow-node min-w-[120px] border-l-green-500', selected && 'selected')}>
      <Handle type="target" position={Position.Top} />
      <div className="p-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-green-500/20 text-green-500">
            <Radio className="h-3 w-3" />
          </div>
          <div>
            <div className="text-xs font-medium leading-tight">订阅最新价</div>
            <div className="text-[9px] text-muted-foreground">实时</div>
          </div>
        </div>
        {data.symbol && (
          <div className="mt-1 space-y-0.5 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">品种：</span>
              <span className="mono-data font-medium">{data.symbol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">交易所：</span>
              <span className="mono-data">{data.exchange || 'NSE'}</span>
            </div>
            {data.outputVariable && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">输出：</span>
                <span className="mono-data text-green-500">{`{{${data.outputVariable}}}`}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

SubscribeLTPNode.displayName = 'SubscribeLTPNode'
