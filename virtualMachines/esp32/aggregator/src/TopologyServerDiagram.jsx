import React from 'react';

// Dynamically renders a server topology diagram based on the topology prop
export default function TopologyServerDiagram({ topology }) {
  // Count instances by service type
  const serviceCounts = {};
  topology.forEach(node => {
    if (node.details && Array.isArray(node.details.services)) {
      node.details.services.forEach(svc => {
        const key = svc.name;
        serviceCounts[key] = (serviceCounts[key] || 0) + 1;
      });
    }
  });

  // List of unique services
  const services = Object.keys(serviceCounts);

  // List of nodes by type
  const nodes = topology.map(node => ({
    name: node.details?.nodeName || node.mac || node.ip,
    services: node.details?.services || [],
    type: node.details?.type || 'unknown',
  }));

  return (
    <div style={{ margin: '24px 0', background: '#f8fafc', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px #e0e0e0' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1a237e' }}>Server Topology Diagram</h3>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Service summary */}
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Services & Instances</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14 }}>
            {services.length === 0 && <li style={{ color: '#888' }}>No services found</li>}
            {services.map(svc => (
              <li key={svc} style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{svc}</span>: {serviceCounts[svc]} instance{serviceCounts[svc] > 1 ? 's' : ''}
              </li>
            ))}
          </ul>
        </div>
        {/* Node cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {nodes.map((node, i) => (
            <div key={i} style={{ border: '1px solid #bdbdbd', borderRadius: 6, background: '#fff', padding: 10, minWidth: 120, boxShadow: '0 1px 2px #eee', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, color: '#1976d2', marginBottom: 2 }}>{node.name}</div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>Type: {node.type}</div>
              <div style={{ fontSize: 13, color: '#333' }}>Services:
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {node.services.length === 0 && <li style={{ color: '#aaa' }}>None</li>}
                  {node.services.map((svc, j) => (
                    <li key={j}>{svc.name || svc}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
