// Node Card Renderer - Simple card view for node data
import React from 'react';

/**
 * NodeCardRenderer - Displays node information in a card format
 */
const NodeCardRenderer = ({ file, role, mode }) => {
  const node = file || {};
  const name = node.name || 'Unnamed Node';
  const type = node.type || 'unknown';
  const status = node.status || 'inactive';
  const description = node.description || '';
  const metadata = node.metadata || {};

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'pending': return '#2196f3';
      default: return '#9e9e9e';
    }
  };

  const getTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'service': return '⚙️';
      case 'workflow': return '🔄';
      case 'data': return '📊';
      case 'queue': return '📬';
      case 'server': return '🖥️';
      default: return '📦';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: '#333' }}>
            Node View
          </span>
          <span style={{ 
            fontSize: '0.75rem', 
            padding: '0.25rem 0.5rem', 
            backgroundColor: '#9c27b0',
            color: '#fff',
            borderRadius: '3px',
          }}>
            ANALYST
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Role: {role}
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          {/* Card Header */}
          <div style={{
            padding: '1.5rem',
            background: `linear-gradient(135deg, ${getStatusColor(status)}22 0%, ${getStatusColor(status)}44 100%)`,
            borderBottom: '1px solid #e0e0e0',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '0.5rem',
            }}>
              <span style={{ fontSize: '2rem' }}>
                {getTypeIcon(type)}
              </span>
              <div style={{ flex: 1 }}>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  color: '#333',
                  fontWeight: 'bold',
                }}>
                  {name}
                </h2>
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '3px',
                    color: '#666',
                  }}>
                    {type}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: getStatusColor(status),
                    color: '#fff',
                    borderRadius: '3px',
                    fontWeight: 'bold',
                  }}>
                    {status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div style={{ padding: '1.5rem' }}>
            {description && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Description
                </h3>
                <p style={{
                  margin: 0,
                  color: '#333',
                  lineHeight: 1.6,
                }}>
                  {description}
                </p>
              </div>
            )}

            {Object.keys(metadata).length > 0 && (
              <div>
                <h3 style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Metadata
                </h3>
                <div style={{
                  backgroundColor: '#f9f9f9',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '1rem',
                }}>
                  {Object.entries(metadata).map(([key, value]) => (
                    <div 
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #e0e0e0',
                      }}
                    >
                      <span style={{
                        fontWeight: 'bold',
                        color: '#666',
                        fontSize: '0.875rem',
                      }}>
                        {key}:
                      </span>
                      <span style={{
                        color: '#333',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                      }}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!description && Object.keys(metadata).length === 0 && (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#999',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ℹ️</div>
                <div>No additional information available</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeCardRenderer;

// Made with Bob
