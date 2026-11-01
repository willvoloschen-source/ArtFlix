import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

type InputPart = { type: 'text'; text: string } | { type: 'image'; mime_type: string; data: string };

function toOpenAiContent(parts: InputPart[]): Array<Record<string, string>> {
  if (!Array.isArray(parts) || parts.length > 8) throw new Error('Entrada de IA inválida.');
  return parts.map(part => {
    if (part.type === 'text' && typeof part.text === 'string' && part.text.length <= 20000) {
      return { type: 'input_text', text: part.text };
    }
    if (part.type === 'image' && /^(image\/png|image\/jpeg|image\/webp)$/.test(part.mime_type) && /^[A-Za-z0-9+/=]+$/.test(part.data) && part.data.length <= 8_000_000) {
      return { type: 'input_image', image_url: `data:${part.mime_type};base64,${part.data}` };
    }
    throw new Error('Imagem ou texto inválido para a IA.');
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: 'Sessão necessária.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !publishableKey) return json({ error: 'Supabase não configurado.' }, 503);
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Sessão inválida.' }, 401);
  const { data: profile, error: profileError } = await supabase.from('artflix_profiles').select('active').eq('id', auth.user.id).single();
  if (profileError || !profile?.active) return json({ error: 'Conta sem acesso ativo.' }, 403);

  const identityDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(auth.user.id));
  const safetyIdentifier = Array.from(new Uint8Array(identityDigest), byte => byte.toString(16).padStart(2, '0')).join('');

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'OPENAI_API_KEY ainda não configurada no Supabase.' }, 503);

  try {
    const raw = await request.text();
    if (raw.length > 18_000_000) return json({ error: 'Imagens acima do limite de 18 MB por solicitação.' }, 413);
    const payload = JSON.parse(raw);
    if (payload.action !== 'plan' && payload.action !== 'image') return json({ error: 'Ação inválida.' }, 400);
    const content = toOpenAiContent(payload.inputParts);
    const model = Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-6.1-terra';
    const input = [{ role: 'user', content }];

    const body = payload.action === 'plan'
      ? {
          model,
          instructions: String(payload.systemInstruction || '').slice(0, 20000),
          input,
          text: { format: { type: 'json_schema', name: 'artflix_map_plan', strict: true, schema: payload.schema } },
          max_output_tokens: 6000,
          safety_identifier: safetyIdentifier,
          store: false
        }
      : {
          model,
          input: [{ role: 'user', content: [
            ...content,
            { type: 'input_text', text: `Formato desejado: ${String(payload.aspectRatio || '1:1').slice(0, 10)}. Preserve a composição e gere apenas a arte final.` }
          ] }],
          tools: [{ type: 'image_generation', model: Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2.5-flare' }],
          tool_choice: { type: 'image_generation' },
          safety_identifier: safetyIdentifier,
          store: false
        };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) return json({ error: result.error?.message || `OpenAI respondeu ${response.status}.` }, 502);

    if (payload.action === 'image') {
      const image = result.output?.find((item: { type: string; result?: string }) => item.type === 'image_generation_call')?.result;
      if (!image) return json({ error: 'OpenAI não retornou uma imagem.' }, 502);
      return json({ imageDataUrl: `data:image/png;base64,${image}` });
    }
    const text = result.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content || [])
      .filter((item: { type: string }) => item.type === 'output_text')
      .map((item: { text?: string }) => item.text || '').join('') || result.output_text;
    if (!text) return json({ error: 'OpenAI não retornou o plano.' }, 502);
    return json({ plan: JSON.parse(text) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha no processamento da IA.' }, 400);
  }
});
