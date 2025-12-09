export enum MessageSender {
  USER = 'user',
  MANUALITO = 'manualito',
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
}

export enum DiagnosticStep {
  INITIAL = 'INITIAL',
  ROLES_GRADOS = 'ROLES_GRADOS',
  DESCRIPCION_ACCION = 'DESCRIPCION_ACCION',
  CONTEXTO_REINCIDENCIA = 'CONTEXTO_REINCIDENCIA',
  COMPLETED = 'COMPLETED',
}

export interface ManualitoDiagnosticData {
  rolesYGrados: string;
  descripcionDeLaAccion: string;
  contextoYReincidencia: string;
}

export interface ManualitoResponse {
  classification: string;
  dutyCited: string;
  protocolName: string;
  immediateAction: string;
  documentationTool: string;
  attentionLines?: { name: string; number: string; }[];
  finalCallToAction: string;
}
