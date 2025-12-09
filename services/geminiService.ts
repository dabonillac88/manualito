import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';
import { MANUALITO_SYSTEM_INSTRUCTION, ATTENTION_LINES } from '../constants';
import { ManualitoResponse } from '../types';

/**
 * Initializes and uses the Google Gemini API to generate content.
 */
export async function getManualitoResponse(
  userPrompt: string,
  fullConversationHistory: string,
): Promise<ManualitoResponse> {
  // CRITICAL: Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const model = 'gemini-3-pro-preview';

  // Construct the full system instruction including the dynamic conversation history
  const combinedSystemInstruction = `${MANUALITO_SYSTEM_INSTRUCTION}

  Historial de la conversación hasta ahora:
  ${fullConversationHistory}
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: combinedSystemInstruction,
        temperature: 0.2, // Keep temperature low for precise, rule-based responses
        maxOutputTokens: 1500, // Increased maxOutputTokens
        // Fix: Add thinkingConfig to ensure tokens are reserved for the actual output
        thinkingConfig: { thinkingBudget: 256 }, 
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No text response received from Manualito.");
    }

    // Parse the Markdown response from Manualito
    return parseManualitoResponse(textResponse);

  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    // Handle API key errors specifically
    if (String(error).includes("API_KEY")) {
      // Prompt user to select API key if it's an issue with the key (e.g., missing or invalid)
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        alert("Parece que hay un problema con la clave API. Por favor, selecciona tu clave API.");
        window.aistudio.openSelectKey();
        throw new Error("API key not selected or invalid. Please try again after selecting a key.");
      } else {
        throw new Error("API key is not configured or invalid. Please ensure process.env.API_KEY is set correctly.");
      }
    }
    throw new Error(`Error al obtener respuesta de Manualito: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parses the Markdown response from Manualito into a structured object.
 */
function parseManualitoResponse(markdown: string): ManualitoResponse {
  const response: ManualitoResponse = {
    classification: 'N/A',
    dutyCited: 'N/A',
    protocolName: 'N/A',
    immediateAction: 'N/A',
    documentationTool: 'N/A',
    finalCallToAction: '',
  };

  // Extract Classification details
  const classificationMatch = markdown.match(/\*\*Tipo de Situación:\*\*\s*(.+)/);
  if (classificationMatch && classificationMatch[1]) {
    response.classification = classificationMatch[1].trim();
  }

  const dutyMatch = markdown.match(/\*\*Deber Violado:\*\*\s*(.+)/);
  if (dutyMatch && dutyMatch[1]) {
    response.dutyCited = dutyMatch[1].trim();
  }

  const protocolMatch = markdown.match(/\*\*Protocolo a Seguir:\*\*\s*(.+)/);
  if (protocolMatch && protocolMatch[1]) {
    response.protocolName = protocolMatch[1].trim();
  }

  // Extract Plan de Acción details
  const immediateActionMatch = markdown.match(/1\.\s*\*\*Acción Inmediata \(Mandatoria\):\*\*\s*(.+)/);
  if (immediateActionMatch && immediateActionMatch[1]) {
    response.immediateAction = immediateActionMatch[1].trim();
  }

  const documentationMatch = markdown.match(/2\.\s*\*\*Documentación:\*\*\s*(.+)/);
  if (documentationMatch && documentationMatch[1]) {
    response.documentationTool = documentationMatch[1].trim();
  }

  // Extract Lines of Attention if present (only for Tipo III)
  if (response.classification.includes('Tipo III')) {
    response.attentionLines = ATTENTION_LINES;
  }

  // Extract Final Call to Action
  const finalCallToActionMatch = markdown.match(/Siga el Protocolo de atención situaciones tipo\s*\[([XI]+)\]\s*\(Página\/Artículo:\s*\[(.+)\]\)\s*para dar inicio al debido proceso y registro en la plataforma institucional\./);
  if (finalCallToActionMatch && finalCallToActionMatch[1] && finalCallToActionMatch[2]) {
    response.finalCallToAction = `Siga el Protocolo de atención situaciones tipo ${finalCallToActionMatch[1]} (Página/Artículo: ${finalCallToActionMatch[2]}) para dar inicio al debido proceso y registro en la plataforma institucional.`;
  } else {
    // Fallback if regex doesn't catch it perfectly
    const generalFinalCallToActionMatch = markdown.match(/Siga el Protocolo de atención situaciones tipo\s*(.+?)\s*para dar inicio al debido proceso y registro en la plataforma institucional\./);
    if (generalFinalCallToActionMatch && generalFinalCallToActionMatch[1]) {
      response.finalCallToAction = `Siga el Protocolo de atención situaciones tipo ${generalFinalCallToActionMatch[1].trim()} para dar inicio al debido proceso y registro en la plataforma institucional.`;
    } else {
      response.finalCallToAction = "Por favor, consulte el Manual de Convivencia para el siguiente paso en el debido proceso.";
    }
  }

  return response;
}