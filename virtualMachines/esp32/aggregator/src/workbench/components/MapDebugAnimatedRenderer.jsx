// Map Debug Animated Renderer - Animated data mapping debugger
import React from 'react';

/**
 * MapDebugAnimatedRenderer - Displays data mappings with debug state highlighting
 */
const MapDebugAnimatedRenderer = ({ file, role, mode, debugState }) => {
  const mappings = file?.mappings || [];
  const fileName = file?.name || 'Untitled.map';
  const currentStep = debugState?.currentStep || 0;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Mapping Table */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
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
              backgroundColor: '#f44336',
              color: '#fff',
              borderRadius: '3px',
            }}>
              DEBUG MODE
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            Step: {currentStep + 1} / {mappings.length}
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
                    textAlign: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    fontWeight: 'bold',
                    color: '#333',
                    width: '10%',
                  }}>
                    →
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    borderBottom: '2px solid #e0e0e0',
                    fontWeight: 'bold',
                    color: '#333',
                    width: '25%',
                  }}>
                    Transform
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    fontWeight: 'bold',
                    color: '#333',
                    width: '10%',
                  }}>
                    →
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
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, index) => {
                  const isActive = index === currentStep;
                  const isPast = index < currentStep;
                  
                  return (
                    <tr 
                      key={index}
                      style={{
                        borderBottom: '1px solid #e0e0e0',
                        backgroundColor: isActive 
                          ? '#fff3e0' 
                          : isPast 
                            ? '#e8f5e9' 
                            : 'transparent',
                        transition: 'background-color 0.3s',
                      }}
                    >
                      <td style={{
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: isActive ? '#e65100' : isPast ? '#2e7d32' : '#2196f3',
                        fontWeight: isActive ? 'bold' : 'normal',
                        position: 'relative',
                      }}>
                        {isActive && (
                          <span style={{
                            position: 'absolute',
                            left: '0.25rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '1.2rem',
                          }}>
                            ▶
                          </span>
                        )}
                        <span style={{ marginLeft: isActive ? '1.5rem' : '0' }}>
                          {mapping.sourceField}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        color: isActive ? '#ff9800' : '#ccc',
                      }}>
                        →
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: isActive ? '#e65100' : isPast ? '#2e7d32' : '#666',
                        fontWeight: isActive ? 'bold' : 'normal',
                        fontStyle: mapping.transform ? 'normal' : 'italic',
                      }}>
                        {mapping.transform || 'direct'}
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        color: isActive ? '#ff9800' : '#ccc',
                      }}>
                        →
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: isActive ? '#e65100' : isPast ? '#2e7d32' : '#4caf50',
                        fontWeight: isActive ? 'bold' : 'normal',
                      }}>
                        {mapping.targetField}
                      </td>
                    </tr>
                  );
                })}
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

      {/* Debug Info Panel */}
      <div style={{
        width: '280px',
        backgroundColor: '#fafafa',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        fontSize: '0.875rem',
        padding: '1rem',
      }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '0.875rem', 
          fontWeight: 'bold', 
          color: '#f44336',
        }}>
          Current Mapping
        </h3>
        
        {mappings[currentStep] ? (
          <div>
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#2196f3',
                marginBottom: '0.5rem',
              }}>
                Source
              </div>
              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '0.8rem',
                wordBreak: 'break-all',
              }}>
                {mappings[currentStep].sourceField}
              </div>
            </div>

            {mappings[currentStep].transform && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fff3e0',
                border: '1px solid #ff9800',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#ff9800',
                  marginBottom: '0.5rem',
                }}>
                  Transform
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                }}>
                  {mappings[currentStep].transform}
                </div>
              </div>
            )}

            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#4caf50',
                marginBottom: '0.5rem',
              }}>
                Target
              </div>
              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '0.8rem',
                wordBreak: 'break-all',
              }}>
                {mappings[currentStep].targetField}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No mapping selected
          </div>
        )}

        <div style={{ 
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e0e0e0',
        }}>
          <h3 style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '0.875rem', 
            fontWeight: 'bold', 
            color: '#666',
          }}>
            Progress
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{
              flex: 1,
              height: '8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${mappings.length > 0 ? ((currentStep + 1) / mappings.length) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#4caf50',
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              {Math.round(mappings.length > 0 ? ((currentStep + 1) / mappings.length) * 100 : 0)}%
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#999' }}>
            {currentStep + 1} of {mappings.length} mappings
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapDebugAnimatedRenderer;

// Made with Bob
