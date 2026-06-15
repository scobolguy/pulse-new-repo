// Map Spreadsheet Renderer - Data mapping table view
import React from 'react';

/**
 * MapSpreadsheetRenderer - Displays data mappings in a spreadsheet-style table
 */
const MapSpreadsheetRenderer = ({ file, role, mode }) => {
  const mappings = file?.mappings || [];
  const fileName = file?.name || 'Untitled.map';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: '#333' }}>
            {fileName}
          </span>
          <span style={{ 
            fontSize: '0.75rem', 
            padding: '0.25rem 0.5rem', 
            backgroundColor: '#ff9800',
            color: '#fff',
            borderRadius: '3px',
          }}>
            MAP VIEW
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Role: {role} | Mappings: {mappings.length}
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '1rem',
      }}>
        {mappings.length > 0 ? (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #e0e0e0',
                  fontWeight: 'bold',
                  color: '#333',
                  width: '35%',
                }}>
                  Source Field
                </th>
                <th style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #e0e0e0',
                  fontWeight: 'bold',
                  color: '#333',
                  width: '35%',
                }}>
                  Target Field
                </th>
                <th style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #e0e0e0',
                  fontWeight: 'bold',
                  color: '#333',
                  width: '30%',
                }}>
                  Transform
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping, index) => (
                <tr 
                  key={index}
                  style={{
                    borderBottom: '1px solid #e0e0e0',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{
                    padding: '0.75rem 1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#2196f3',
                  }}>
                    {mapping.sourceField}
                  </td>
                  <td style={{
                    padding: '0.75rem 1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#4caf50',
                  }}>
                    {mapping.targetField}
                  </td>
                  <td style={{
                    padding: '0.75rem 1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#666',
                  }}>
                    {mapping.transform || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#999',
            fontSize: '1rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <div>No mappings defined</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSpreadsheetRenderer;

// Made with Bob
