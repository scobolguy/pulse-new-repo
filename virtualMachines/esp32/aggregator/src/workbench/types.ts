// Core type definitions for the IBM BOB Workbench system

export type Role = string;
export type FileType = string;
export type Mode = string;

export interface RendererKey {
  role: Role;
  fileType: FileType;
  mode: Mode;
}

export interface RendererEntry {
  key: RendererKey;
  component: React.ComponentType<any>;
  priority?: number;
}

export interface FileData {
  fileType: FileType;
  content: string;
  name?: string;
  path?: string;
  [key: string]: any;
}

export interface RendererProps {
  file: FileData;
  role: Role;
  mode: Mode;
  [key: string]: any;
}

// Workflow/FSM execution event types
export type WorkflowEventType = 
  | "STATE_ENTER" 
  | "STATE_EXIT" 
  | "TRANSITION" 
  | "FLOW_START" 
  | "FLOW_END";

export interface WorkflowEvent {
  type: WorkflowEventType;
  stateId?: string;
  fromStateId?: string;
  toStateId?: string;
  timestamp: number;
}

export interface ExecutionState {
  activeStates: string[];
  history: WorkflowEvent[];
}

// Debug state for various renderers
export interface DebugState {
  currentLine?: number;
  registers?: Record<string, any>;
  stack?: any[];
  variables?: Record<string, any>;
  currentStep?: number;
  [key: string]: any;
}

// Mermaid renderer props
export interface MermaidRendererProps {
  mermaidSource: string;
  activeStates?: string[];
  className?: string;
}

// Map DSL types
export interface MappingRule {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface MapData extends FileData {
  fileType: "map";
  mappings: MappingRule[];
}

// Made with Bob
