import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, MessageSender, DiagnosticStep, ManualitoDiagnosticData, ManualitoResponse } from '../types';
import ChatMessageComponent from './ChatMessage';
import UserInput from './UserInput';
import { getManualitoResponse } from '../services/geminiService';
import { ATTENTION_LINES } from '../constants';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState<DiagnosticStep>(DiagnosticStep.INITIAL);
  const [diagnosticData, setDiagnosticData] = useState<ManualitoDiagnosticData>({
    rolesYGrados: '',
    descripcionDeLaAccion: '',
    contextoYReincidencia: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial message from Manualito to start the diagnostic protocol
  useEffect(() => {
    if (diagnosticStep === DiagnosticStep.INITIAL && messages.length === 0) {
      setMessages([
        {
          id: 'manualito-initial',
          sender: MessageSender.MANUALITO,
          text: `Hola, soy MANUALITO, el asistente experto en convivencia escolar de la Institución Educativa Santa Juana de Lestonnac. Estoy aquí para ayudarte a aplicar el Manual de Convivencia 2026.

Para iniciar el protocolo de diagnóstico rápido, por favor, dime:
**¿Quiénes están involucrados (estudiante, docente, acudiente, etc.) y a qué grados pertenecen los estudiantes?**`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setDiagnosticStep(DiagnosticStep.ROLES_GRADOS);
    }
  }, [diagnosticStep, messages.length]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const getPlaceholder = useCallback(() => {
    switch (diagnosticStep) {
      case DiagnosticStep.ROLES_GRADOS:
        return 'Ej: Un estudiante de 5to grado y otro de 7mo grado.';
      case DiagnosticStep.DESCRIPCION_ACCION:
        return 'Ej: Agresión física entre los estudiantes.';
      case DiagnosticStep.CONTEXTO_REINCIDENCIA:
        return 'Ej: Es la primera vez. No hubo daño al cuerpo. No hay evidencia de dolo.';
      case DiagnosticStep.COMPLETED:
        return 'El diagnóstico ha sido completado. Puedes hacer preguntas de seguimiento.';
      default:
        return 'Escribe tu mensaje...';
    }
  }, [diagnosticStep]);

  const addMessage = useCallback((sender: MessageSender, text: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: Date.now().toString(),
        sender,
        text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    addMessage(MessageSender.USER, text);
    setIsLoading(true);

    let nextStep = diagnosticStep;
    let fullPrompt = '';
    let currentDiagnosticData = { ...diagnosticData };

    switch (diagnosticStep) {
      case DiagnosticStep.ROLES_GRADOS:
        currentDiagnosticData.rolesYGrados = text;
        setDiagnosticData(currentDiagnosticData);
        addMessage(MessageSender.MANUALITO, '**¿Cuál es el síntoma/acción principal del problema?** (Ej: Agresión física, impuntualidad, fraude académico)');
        nextStep = DiagnosticStep.DESCRIPCION_ACCION;
        break;
      case DiagnosticStep.DESCRIPCION_ACCION:
        currentDiagnosticData.descripcionDeLaAccion = text;
        setDiagnosticData(currentDiagnosticData);
        addMessage(MessageSender.MANUALITO, '**¿Es la primera vez? ¿Hubo daño al cuerpo o a la salud? ¿Hay evidencia de sistematicidad o dolo?** (Ej: Es la primera vez. No hubo daño al cuerpo. No hay evidencia de dolo.)');
        nextStep = DiagnosticStep.CONTEXTO_REINCIDENCIA;
        break;
      case DiagnosticStep.CONTEXTO_REINCIDENCIA:
        currentDiagnosticData.contextoYReincidencia = text;
        setDiagnosticData(currentDiagnosticData);
        nextStep = DiagnosticStep.COMPLETED;

        // Combine all diagnostic data for the final prompt to Gemini
        fullPrompt = `
        He recopilado la siguiente información del incidente:
        - Roles y grados de los involucrados: ${currentDiagnosticData.rolesYGrados}
        - Descripción de la acción principal: ${currentDiagnosticData.descripcionDeLaAccion}
        - Contexto y reincidencia: ${currentDiagnosticData.contextoYReincidencia}

        Con base en esta información y estrictamente en el Manual de Convivencia 2026, por favor clasifica el suceso en Situación Tipo I, II o III, cita el deber violado (Sección 4.5, 4.6 o 4.7 y el número de deber si aplica, o el rango de deberes para Tipo III), identifica el protocolo a seguir y genera el plan de acción de 3 pasos (Acción Inmediata, Documentación). Asegúrate de incluir la frase final obligatoria. Si es Tipo III, incluye también las líneas de atención de la Sección 8.
        `;
        break;
      case DiagnosticStep.COMPLETED:
        // User is asking a follow-up question
        fullPrompt = text;
        break;
    }

    setDiagnosticStep(nextStep);

    if (nextStep === DiagnosticStep.COMPLETED) { // Only call Gemini after all diagnostic info is collected
      try {
        const conversationHistory = messages.map(msg => `${msg.sender === MessageSender.USER ? 'Usuario' : 'Manualito'}: ${msg.text}`).join('\n');
        const manualitoResponse = await getManualitoResponse(fullPrompt, conversationHistory);

        const formattedResponse = `
        ## Clasificación del Incidente
        **Tipo de Situación:** ${manualitoResponse.classification}
        **Deber Violado:** ${manualitoResponse.dutyCited}
        **Protocolo a Seguir:** ${manualitoResponse.protocolName}

        ### Plan de Acción
        1.  **Acción Inmediata (Mandatoria):** ${manualitoResponse.immediateAction}
        2.  **Documentación:** ${manualitoResponse.documentationTool}
        ${manualitoResponse.attentionLines && manualitoResponse.attentionLines.length > 0
          ? `\n### Líneas de Atención (Sección 8)\n` +
            manualitoResponse.attentionLines.map(line => `*   **${line.name}:** ${line.number}`).join('\n')
          : ''}
        \n${manualitoResponse.finalCallToAction}
        `;

        addMessage(MessageSender.MANUALITO, formattedResponse);
      } catch (error) {
        addMessage(MessageSender.MANUALITO, `Lo siento, hubo un error al procesar tu solicitud: ${(error as Error).message}.`);
      }
    }
    setIsLoading(false);
  }, [diagnosticStep, diagnosticData, messages, addMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50 shadow-lg rounded-lg overflow-hidden">
      <div className="flex items-center p-4 bg-red-800 text-white shadow-md">
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqa/AAALV0lEQVR4Xu3dS24kcxKG4e1G/g/oGz8G/y/oG/0c/pPZG/s8g9o/Bf6B/2z2f4Oq1T/1n+QfgMAf4h1/AAAgBAAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAhAAAfwBCAQAAwC7AAEBAAAA/6MBAAAAAgAAAP+aAQAAAwAAAP+TAgAABAAAAP+wBAAABQAAAP/hBgAABgAAAP+7CAAABwAAAP/PCgAACAAAAP/UDAAACQAAAP/XDgAADAAAAP/bEAAADQAAAP/eFAAADgAAAP/++GwAADwAAAP/++IgAABAAAAP/++JgAABQAAAP/++J4AABgAAAP/++KEAABwAAAP/++LAAACAAAAP/++LMAACQAAAP/++MgAADAAAAP/++MwAADQAAAP/++NgAADgAAAP/++OAAADwAAAP/++OIAABAAAAP/++OQAAQAAAP/++OgAAQAAAP/++OwAAQAAAP/++PAAAQAAAP/++PEAAQAAAP/++PQAAQAAAP/++P0AAQAAAP/++QAAARAAAP/++QIAARAAAP/++QUAAA=="
          alt="Escudo Institución Educativa Santa Juana de Lestonnac"
          style={{ height: '60px', marginRight: '16px' }}
        />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">Manualito - Asistente de Convivencia</h1>
          <p className="text-sm">Institución Educativa Santa Juana de Lestonnac</p>
          <p className="text-xs opacity-80">Desarrollado por: Diana Alejandra Bonilla Cardona</p>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] px-4 py-2 rounded-lg shadow-md bg-blue-600 text-white rounded-bl-none">
              <div className="font-semibold mb-1">Manualito</div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-none sticky bottom-0">
        <UserInput onSendMessage={handleSendMessage} isLoading={isLoading} placeholder={getPlaceholder()} />
      </div>
    </div>
  );
};

export default ChatWindow;