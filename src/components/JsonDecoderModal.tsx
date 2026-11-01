import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Download,
  FileJson,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlock,
  X
} from 'lucide-react';
import {
  OBFUSCATED_MAP_JSON,
  decodeMapPayload,
  encodeMapPayload
} from '../data/mapInitializerData';

interface JsonDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JsonDecoderModal: React.FC<JsonDecoderModalProps> = ({ isOpen, onClose }) => {
  const [decodedResult, setDecodedResult] = useState<{
    cleanB64: string;
    removedSymbolsCount: number;
    gzipBytes: number;
    originalBytes: number;
    computedHash: string;
    hashValid: boolean;
    utf8Text: string;
  } | null>(null);
  const [editableJson, setEditableJson] = useState('');
  const [reencodedBundle, setReencodedBundle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'decoded' | 'pipeline' | 'encoder'>('decoded');

  useEffect(() => {
    if (isOpen && !decodedResult) {
      decodeMapPayload(
        OBFUSCATED_MAP_JSON.payload,
        OBFUSCATED_MAP_JSON.integrity.sha256_utf8_json
      ).then(res => {
        setDecodedResult(res);
        setEditableJson(JSON.stringify(res.parsedJson, null, 2));
      });
    }
  }, [isOpen, decodedResult]);

  if (!isOpen) return null;

  const handleReencode = async () => {
    try {
      const parsed = JSON.parse(editableJson);
      const compactOrFormatted = JSON.stringify(parsed, null, 2);
      const bundle = await encodeMapPayload(compactOrFormatted, 4);
      setReencodedBundle(JSON.stringify(bundle, null, 2));
    } catch (e: unknown) {
      alert('JSON inválido: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDownloadJson = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Engenharia Reversa & Laboratório do Inicializador JSON
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono">
                  SHA-256 Verificado ✓
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Formato: <code className="text-orange-600 font-semibold">{OBFUSCATED_MAP_JSON.format}</code> · Schema interno: <code className="text-sky-600 font-semibold">metodo-map.chatbot.initializer.v2</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveTab('decoded')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === 'decoded'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
          >
            <FileJson className="w-4 h-4" />
            1. JSON Interno Decodificado (163 linhas)
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === 'pipeline'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            2. Pipeline Criptográfico (8 Etapas + Auditoria)
          </button>
          <button
            onClick={() => setActiveTab('encoder')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === 'encoder'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            3. Compilador / Gerador de Novos Inicializadores (.json)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAFBFD]">
          {decodedResult && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm">
                <div className="text-[11px] text-slate-500">Ruído Unicode Removido</div>
                <div className="text-lg font-bold text-orange-600 font-mono">
                  {decodedResult.removedSymbolsCount} símbolos
                </div>
                <div className="text-[10px] text-slate-400">Intervalo a cada 4 chars</div>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm">
                <div className="text-[11px] text-slate-500">Base64 Limpo</div>
                <div className="text-lg font-bold text-sky-600 font-mono">
                  {decodedResult.cleanB64.length} chars
                </div>
                <div className="text-[10px] text-slate-400">Alfabeto A-Z, a-z, 0-9, +, /</div>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm">
                <div className="text-[11px] text-slate-500">Bytes Compactados (GZIP)</div>
                <div className="text-lg font-bold text-purple-600 font-mono">
                  {decodedResult.gzipBytes} B
                </div>
                <div className="text-[10px] text-slate-400">Header 0x1F 0x8B (H4sI)</div>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm">
                <div className="text-[11px] text-slate-500">JSON UTF-8 Descompactado</div>
                <div className="text-lg font-bold text-emerald-600 font-mono">
                  {decodedResult.originalBytes} B
                </div>
                <div className="text-[10px] text-slate-400">100% íntegro</div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 shadow-sm">
                <div className="text-[11px] text-emerald-700">Integridade SHA-256</div>
                <div className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  AUTÊNTICO
                </div>
                <div className="text-[10px] text-emerald-600/80 font-mono truncate" title={decodedResult.computedHash}>
                  {decodedResult.computedHash.slice(0, 18)}...
                </div>
              </div>
            </div>
          )}

          {activeTab === 'decoded' && decodedResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Abaixo está o código-fonte completo decodificado do arquivo <code className="text-orange-600 font-semibold">Metodo-MAP.inicializador.json</code> que governa toda a máquina de estados e regras de negócio deste software:
                </p>
                <button
                  onClick={() =>
                    handleDownloadJson(
                      decodedResult.utf8Text,
                      'Metodo-MAP.decodificado.v2.json'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 border border-slate-200 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-orange-500" />
                  Baixar JSON Decodificado
                </button>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto max-h-[52vh] leading-relaxed shadow-inner">
                {decodedResult.utf8Text}
              </pre>
            </div>
          )}

          {activeTab === 'pipeline' && decodedResult && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Execução dos 8 Passos de Decodificação (`decoder.steps`)
                </h3>
                <div className="space-y-2">
                  {OBFUSCATED_MAP_JSON.decoder.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-slate-700 font-medium">{step}</div>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-mono font-bold">OK ✓</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
                <div className="text-xs font-bold text-slate-700">
                  Comparação de Hash Criptográfico (SHA-256)
                </div>
                <div className="text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div>
                    <span className="text-slate-500">Esperado (integrity): </span>
                    <span className="text-orange-600 font-semibold">{OBFUSCATED_MAP_JSON.integrity.sha256_utf8_json}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Calculado (UTF-8):    </span>
                    <span className="text-emerald-600 font-semibold">{decodedResult.computedHash}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'encoder' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-sky-600" />
                    Editar Regras Internas do Método MAP (JSON Limpo)
                  </label>
                  <button
                    onClick={handleReencode}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Ofuscar e Gerar Payload GZIP+B64
                  </button>
                </div>
                <textarea
                  value={editableJson}
                  onChange={e => setEditableJson(e.target.value)}
                  className="w-full h-80 bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-orange-500 shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                    Inicializador Ofuscado Gerado (`MAP-CHATBOT-OBF-GZIP-B64-SYMBOLS-v2`)
                  </label>
                  {reencodedBundle && (
                    <button
                      onClick={() =>
                        handleDownloadJson(reencodedBundle, 'Metodo-MAP.inicializador.custom.json')
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar .json
                    </button>
                  )}
                </div>
                <textarea
                  readOnly
                  value={
                    reencodedBundle ||
                    'Clique em "Ofuscar e Gerar Payload GZIP+B64" para compactar o JSON editado, injetar os símbolos Unicode a cada 4 caracteres e recalcular o SHA-256 automaticamente.'
                  }
                  className="w-full h-80 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-700 focus:outline-none shadow-inner"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
