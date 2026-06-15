import React from 'react';

const GRID_SIZE = 32;
const BLOCK_WIDTH = 224;
const BLOCK_HEIGHT = 92;

export default function SharedBlockWorkspace({
  blockLibrary,
  nodes,
  edges,
  selectedNode,
  selectedNodeId,
  connectFrom,
  connectTo,
  connectLabel,
  onConnectFromChange,
  onConnectToChange,
  onConnectLabelChange,
  onAddEdge,
  onRemoveEdge,
  onAddNode,
  onNodeDragStart,
  onNodeSelect,
  onCanvasDrop,
  onDeleteSelectedNode,
  summarizeNode,
  renderSelectionFields,
  renderRightPanel,
  canvasRef,
  supportsConditionEdges = false,
  canvasWidth = 2400,
  canvasHeight = 1600,
  leftPanelTitle = 'Block Toolbox',
  selectionEmptyLabel = 'Select a block on the canvas.'
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr) 440px', gap: 12, height: '100%', minHeight: 620 }}>
      <aside style={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: 10, background: 'rgba(15, 23, 42, 0.55)', overflow: 'auto' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75, marginBottom: 8 }}>{leftPanelTitle}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {blockLibrary.map((item) => (
            <button
              key={item.kind}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('text/pulse-block-kind', item.kind);
              }}
              onClick={() => onAddNode(item.kind)}
              style={{ textAlign: 'left', borderLeft: `4px solid ${item.tone}` }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <hr style={{ borderColor: 'rgba(148,163,184,0.2)', margin: '12px 0' }} />

        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75, marginBottom: 8 }}>Connections</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <select value={connectFrom} onChange={(event) => onConnectFromChange(event.target.value)}>
            <option value="">From block</option>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.title} ({node.kind})</option>)}
          </select>
          <select value={connectTo} onChange={(event) => onConnectToChange(event.target.value)}>
            <option value="">To block</option>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.title} ({node.kind})</option>)}
          </select>
          <input value={connectLabel} onChange={(event) => onConnectLabelChange(event.target.value)} placeholder="Edge label" />
          <button type="button" onClick={() => onAddEdge()}>Connect blocks</button>
          {supportsConditionEdges && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onAddEdge('true')} style={{ flex: 1 }}>True</button>
              <button type="button" onClick={() => onAddEdge('false')} style={{ flex: 1 }}>False</button>
            </div>
          )}
        </div>

        <hr style={{ borderColor: 'rgba(148,163,184,0.2)', margin: '12px 0' }} />

        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75, marginBottom: 8 }}>Selection</div>
        {!selectedNode && <div style={{ fontSize: 12, opacity: 0.75 }}>{selectionEmptyLabel}</div>}
        {selectedNode && (
          <div style={{ display: 'grid', gap: 8 }}>
            {renderSelectionFields(selectedNode)}
            <button type="button" onClick={onDeleteSelectedNode}>Delete block</button>
          </div>
        )}

        <hr style={{ borderColor: 'rgba(148,163,184,0.2)', margin: '12px 0' }} />

        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75, marginBottom: 8 }}>Active edges</div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 200, overflow: 'auto' }}>
          {edges.length === 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>No edges yet.</div>}
          {edges.map((edge) => (
            <div key={edge.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nodes.find((node) => node.id === edge.from)?.title || edge.from} -&gt; {nodes.find((node) => node.id === edge.to)?.title || edge.to}{edge.label ? ` (${edge.label})` : ''}
              </div>
              <button type="button" onClick={() => onRemoveEdge(edge.id)}>x</button>
            </div>
          ))}
        </div>
      </aside>

      <section
        ref={canvasRef}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onCanvasDrop}
        style={{
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.32)',
          overflow: 'auto',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: canvasWidth,
            height: canvasHeight,
            position: 'relative',
            backgroundImage: 'linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
          }}
        >
          <svg width={canvasWidth} height={canvasHeight} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {edges.map((edge) => {
              const from = nodes.find((item) => item.id === edge.from);
              const to = nodes.find((item) => item.id === edge.to);
              if (!from || !to) return null;
              const x1 = from.x + BLOCK_WIDTH;
              const y1 = from.y + (BLOCK_HEIGHT / 2);
              const x2 = to.x;
              const y2 = to.y + (BLOCK_HEIGHT / 2);
              const midX = x1 + ((x2 - x1) / 2);
              const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
              return (
                <g key={edge.id}>
                  <path d={path} stroke="rgba(125, 211, 252, 0.9)" strokeWidth="3" fill="none" />
                  {edge.label ? (
                    <text x={midX} y={(y1 + y2) / 2 - 8} fill="#e2e8f0" fontSize="12" textAnchor="middle">{edge.label}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const blockTone = blockLibrary.find((item) => item.kind === node.kind)?.tone || '#38bdf8';
            return (
              <button
                key={node.id}
                type="button"
                onMouseDown={(event) => onNodeDragStart(event, node)}
                onClick={() => onNodeSelect(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: BLOCK_WIDTH,
                  minHeight: BLOCK_HEIGHT,
                  borderRadius: 14,
                  border: selectedNodeId === node.id ? `2px solid ${blockTone}` : '1px solid rgba(148, 163, 184, 0.45)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92))',
                  color: '#e2e8f0',
                  textAlign: 'left',
                  padding: 12,
                  cursor: 'grab',
                  boxShadow: selectedNodeId === node.id ? `0 0 0 1px ${blockTone}33, 0 16px 32px rgba(2, 6, 23, 0.32)` : '0 10px 24px rgba(2, 6, 23, 0.22)'
                }}
              >
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.08, color: blockTone }}>{node.kind}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{node.title}</div>
                <div style={{ fontSize: 12, opacity: 0.82, marginTop: 6, whiteSpace: 'pre-wrap' }}>{summarizeNode(node)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <aside style={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: 10, background: 'rgba(15, 23, 42, 0.55)', overflow: 'auto', display: 'grid', gap: 10, alignContent: 'start' }}>
        {renderRightPanel()}
      </aside>
    </div>
  );
}