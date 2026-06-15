// WFL DSL to Mermaid State Diagram Converter
// This is a stub implementation that returns a valid Mermaid diagram

/**
 * Convert WFL DSL source code to Mermaid state diagram syntax
 * 
 * @param wflSource - The WFL DSL source code
 * @returns Mermaid state diagram string
 */
export function wflToMermaid(wflSource: string): string {
  // For now, this is a stub that returns a sample Mermaid diagram
  // In a full implementation, this would parse the WFL DSL and generate
  // the appropriate Mermaid syntax
  
  // Check if the source contains any workflow-like keywords
  const hasWorkflowKeywords = /\b(state|transition|workflow|step|start|end)\b/i.test(wflSource);
  
  if (!hasWorkflowKeywords) {
    // Return a simple default diagram
    return `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: start
    Processing --> Complete: finish
    Processing --> Error: fail
    Error --> Idle: retry
    Complete --> [*]`;
  }
  
  // Parse basic workflow structure (simplified)
  const lines = wflSource.split('\n').map(l => l.trim()).filter(Boolean);
  let mermaid = 'stateDiagram-v2\n';
  
  // Extract states and transitions from simple patterns
  const states = new Set<string>();
  const transitions: Array<{ from: string; to: string; label?: string }> = [];
  
  for (const line of lines) {
    // Match patterns like: state StateName
    const stateMatch = line.match(/state\s+(\w+)/i);
    if (stateMatch) {
      states.add(stateMatch[1]);
    }
    
    // Match patterns like: StateA -> StateB : label
    const transitionMatch = line.match(/(\w+)\s*->\s*(\w+)(?:\s*:\s*(.+))?/);
    if (transitionMatch) {
      const [, from, to, label] = transitionMatch;
      states.add(from);
      states.add(to);
      transitions.push({ from, to, label });
    }
  }
  
  // If we found states, build the diagram
  if (states.size > 0) {
    mermaid += '    [*] --> ' + Array.from(states)[0] + '\n';
    
    for (const transition of transitions) {
      if (transition.label) {
        mermaid += `    ${transition.from} --> ${transition.to}: ${transition.label}\n`;
      } else {
        mermaid += `    ${transition.from} --> ${transition.to}\n`;
      }
    }
    
    // Add end state
    const lastState = Array.from(states)[states.size - 1];
    mermaid += `    ${lastState} --> [*]\n`;
  } else {
    // Fallback to default diagram
    mermaid = `stateDiagram-v2
    [*] --> Start
    Start --> Processing: begin
    Processing --> Validation: validate
    Validation --> Complete: success
    Validation --> Error: failure
    Error --> Processing: retry
    Complete --> [*]`;
  }
  
  return mermaid;
}

/**
 * Parse WFL source to extract state names for animation
 * 
 * @param wflSource - The WFL DSL source code
 * @returns Array of state names
 */
export function extractWflStates(wflSource: string): string[] {
  const states = new Set<string>();
  const lines = wflSource.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (const line of lines) {
    const stateMatch = line.match(/state\s+(\w+)/i);
    if (stateMatch) {
      states.add(stateMatch[1]);
    }
    
    const transitionMatch = line.match(/(\w+)\s*->\s*(\w+)/);
    if (transitionMatch) {
      states.add(transitionMatch[1]);
      states.add(transitionMatch[2]);
    }
  }
  
  return Array.from(states);
}

// Made with Bob
