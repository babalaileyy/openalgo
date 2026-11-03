// components/flow/edges/InsertableEdge.tsx
// Custom edge with a "+" button to insert nodes between connected nodes

import { EdgeLabelRenderer, type EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DEFAULT_NODE_DATA } from '@/lib/flow/constants'
import { cn } from '@/lib/utils'

// Node categories for the dropdown menu
const NODE_MENU = {
  Actions: [
    { type: 'placeOrder', label: '下单' },
    { type: 'smartOrder', label: '智能下单' },
    { type: 'optionsOrder', label: '期权下单' },
    { type: 'optionsMultiOrder', label: '多腿期权' },
    { type: 'closePositions', label: '平仓' },
    { type: 'cancelAllOrders', label: '全部撤单' },
  ],
  Logic: [
    { type: 'timeCondition', label: '时间条件' },
    { type: 'positionCheck', label: '持仓检查' },
    { type: 'fundCheck', label: '资金检查' },
    { type: 'priceCondition', label: '价格检查' },
    { type: 'timeWindow', label: '时间区间' },
  ],
  Data: [
    { type: 'getQuote', label: '获取行情' },
    { type: 'getDepth', label: '获取盘口' },
    { type: 'openPosition', label: '查询持仓' },
  ],
  Utility: [
    { type: 'waitUntil', label: '等待至指定时间' },
    { type: 'delay', label: '延时' },
    { type: 'telegramAlert', label: 'Telegram 提醒' },
    { type: 'log', label: '日志' },
    { type: 'variable', label: '变量' },
  ],
}

let nodeIdCounter = 1000

export function InsertableEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  markerEnd,
  selected,
  animated,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow()

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const insertNode = useCallback(
    (nodeType: string) => {
      const nodes = getNodes()
      const edges = getEdges()

      // Generate unique node ID
      const newNodeId = `node_${Date.now()}_${nodeIdCounter++}`

      // Calculate position (midpoint between source and target)
      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)

      if (!sourceNode || !targetNode) return

      const newX = (sourceNode.position.x + targetNode.position.x) / 2
      const newY = (sourceNode.position.y + targetNode.position.y) / 2 + 50

      // Get default data for the node type
      const defaultData = DEFAULT_NODE_DATA[nodeType as keyof typeof DEFAULT_NODE_DATA] || {}

      // Create new node
      const newNode = {
        id: newNodeId,
        type: nodeType,
        position: { x: newX, y: newY },
        data: { ...defaultData },
      }

      // Remove the original edge
      const filteredEdges = edges.filter((e) => e.id !== id)

      // Create two new edges: source -> newNode and newNode -> target
      const newEdge1 = {
        id: `edge-${Date.now()}-1`,
        source,
        target: newNodeId,
        sourceHandle: sourceHandleId || undefined,
        type: 'insertable',
        animated: true,
      }

      const newEdge2 = {
        id: `edge-${Date.now()}-2`,
        source: newNodeId,
        target,
        targetHandle: targetHandleId || undefined,
        type: 'insertable',
        animated: true,
      }

      // Update nodes and edges
      setNodes([...nodes, newNode])
      setEdges([...filteredEdges, newEdge1, newEdge2])
      setMenuOpen(false)
    },
    [source, target, sourceHandleId, targetHandleId, id, getNodes, getEdges, setNodes, setEdges]
  )

  return (
    <>
      {/* Render path directly instead of BaseEdge for better control */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={isHovered || selected ? 3 : 2}
        stroke={isHovered || selected ? '#3b82f6' : '#888888'}
        strokeDasharray={animated ? '5 5' : undefined}
        style={{
          animation: animated ? 'dashdraw 0.5s linear infinite' : undefined,
        }}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => !menuOpen && setIsHovered(false)}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border bg-background shadow-sm transition-all',
                  'hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground',
                  isHovered || menuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
                  selected && 'opacity-100 scale-100'
                )}
              >
                <Plus className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {Object.entries(NODE_MENU).map(([category, nodes]) => (
                <DropdownMenuSub key={category}>
                  <DropdownMenuSubTrigger>
                    <span>{category}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {nodes.map((node) => (
                      <DropdownMenuItem key={node.type} onClick={() => insertNode(node.type)}>
                        {node.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
