import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, MarkerType, Position, Handle } from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent } from './ui/primitives';

type Segment = {
  id: string;
  name: string;
  type: string;
  status: string;
  start_time: string;
  end_time: string;
};

type Dependency = {
  id: string;
  source_id: string;
  target_id: string;
};

type Itinerary = {
  segments: Segment[];
  dependencies: Dependency[];
};

const nodeWidth = 220;
const nodeHeight = 80;

type CustomNodeType = Node<Segment, 'custom'>;

const CustomNode = ({ data }: NodeProps<CustomNodeType>) => {
  const statusColorMap: Record<string, string> = {
    SAFE: 'graph-node-safe',
    AT_RISK: 'graph-node-at-risk',
    HIGH_RISK: 'graph-node-at-risk',
    DISRUPTED: 'graph-node-disrupted',
    RECOVERED: 'graph-node-recovered',
  };

  const colorClass = statusColorMap[data.status] || 'bg-gray-800 border-gray-600 text-white';

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-2 h-2 rounded-full !bg-gray-400" />
      <div className={`p-3 rounded-lg border-2 shadow-lg ${colorClass} min-w-[200px]`}>
        <div className="font-bold text-sm mb-1">{data.name}</div>
        <div className="text-xs opacity-80">{data.type}</div>
        <div className="text-xs opacity-60 mt-1">
          {new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
          {new Date(data.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 rounded-full !bg-gray-400" />
    </>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function DependencyGraph({ itinerary }: { itinerary: Itinerary | null }) {
  const { nodes, edges } = useMemo(() => {
    if (!itinerary) return { nodes: [], edges: [] };

    // Simple horizontal layout algorithm
    const levelMap: Record<string, number> = {};
    const nodesList: Node[] = [];
    const edgesList: Edge[] = [];

    // Calculate topological levels for x positioning
    itinerary.segments.forEach(s => { levelMap[s.id] = 0; });
    let changed = true;
    while (changed) {
      changed = false;
      for (const dep of itinerary.dependencies) {
        if (levelMap[dep.source_id] >= levelMap[dep.target_id]) {
          levelMap[dep.target_id] = levelMap[dep.source_id] + 1;
          changed = true;
        }
      }
    }

    // Assign positions based on level
    const levelCounts: Record<number, number> = {};
    itinerary.segments.forEach(seg => {
      const level = levelMap[seg.id];
      const count = levelCounts[level] || 0;
      levelCounts[level] = count + 1;

      nodesList.push({
        id: seg.id,
        type: 'custom',
        position: { x: level * (nodeWidth + 100), y: count * (nodeHeight + 50) },
        data: { ...seg },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    itinerary.dependencies.forEach(dep => {
      let edgeColor = '#666';
      const targetSeg = itinerary.segments.find(s => s.id === dep.target_id);
      if (targetSeg?.status === 'DISRUPTED') edgeColor = '#ef4444';
      else if (targetSeg?.status === 'AT_RISK') edgeColor = '#eab308';
      else if (targetSeg?.status === 'RECOVERED') edgeColor = '#3b82f6';
      else if (targetSeg?.status === 'SAFE') edgeColor = '#22c55e';

      edgesList.push({
        id: dep.id,
        source: dep.source_id,
        target: dep.target_id,
        animated: targetSeg?.status === 'AT_RISK' || targetSeg?.status === 'DISRUPTED',
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      });
    });

    return { nodes: nodesList, edges: edgesList };
  }, [itinerary]);

  return (
    <Card className="h-[480px] w-full overflow-hidden bg-black/40 border-gray-800">
      <CardContent className="p-0 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#333" gap={16} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </CardContent>
    </Card>
  );
}
