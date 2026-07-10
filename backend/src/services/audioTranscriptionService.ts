// Env vars lidas em tempo de chamada (não no import), mesmo padrão de
// whatsappService.ts — funciona tanto no servidor quanto em scripts
// standalone, sem depender do config.ts.
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

function whatsappCredentials() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  };
}

/** Baixa o áudio da Meta (2 passos: pega a URL temporária, depois baixa o binário) e transcreve via Whisper. */
export async function transcribeWhatsAppAudio(mediaId: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { accessToken } = whatsappCredentials();
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  if (!accessToken || !openaiKey) return { ok: false, error: "credenciais ausentes (WHATSAPP_ACCESS_TOKEN ou OPENAI_API_KEY)" };

  try {
    // 1. Pega a URL temporária do arquivo
    const metaRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const metaData = await metaRes.json();
    if (!metaRes.ok || !metaData.url) return { ok: false, error: `falha ao obter URL da mídia: ${JSON.stringify(metaData)}` };

    // 2. Baixa o binário do áudio
    const audioRes = await fetch(metaData.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!audioRes.ok) return { ok: false, error: `falha ao baixar áudio: ${audioRes.status}` };
    const audioBlob = await audioRes.blob();

    // 3. Transcreve via Whisper (dica de idioma pt pra melhor acurácia)
    const form = new FormData();
    form.append("file", audioBlob, "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    const whisperData = await whisperRes.json();
    if (!whisperRes.ok || !whisperData.text) return { ok: false, error: `falha na transcrição: ${JSON.stringify(whisperData)}` };

    return { ok: true, text: whisperData.text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
