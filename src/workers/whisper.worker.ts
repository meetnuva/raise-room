import {
  AutoProcessor,
  AutoTokenizer,
  full,
  TextStreamer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { AsrWorkerRequest, VoiceLanguage } from "../lib/local-asr";

const modelId = "onnx-community/whisper-tiny";
const maxSamples = 16000 * 30;
let processing = false;

type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
let runtime: Runtime | null = null;

function send(message: unknown) { self.postMessage(message); }

function loading(progress: unknown) {
  const value = progress as { progress?: unknown; status?: unknown; file?: unknown };
  send({ type: "loading", progress: typeof value.progress === "number" && Number.isFinite(value.progress) ? Math.min(1, Math.max(0, value.progress)) : null, message: typeof value.file === "string" ? value.file : typeof value.status === "string" ? value.status : "正在載入本機模型" });
}

async function loadRuntime() {
  const progress_callback = loading;
  try {
    const [tokenizer, processor, model] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId, { progress_callback }),
      AutoProcessor.from_pretrained(modelId, { progress_callback }),
      WhisperForConditionalGeneration.from_pretrained(modelId, { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" }, progress_callback }),
    ]);
    return { tokenizer, processor, model, device: "webgpu" as const };
  } catch {
    const [tokenizer, processor, model] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId, { progress_callback }),
      AutoProcessor.from_pretrained(modelId, { progress_callback }),
      WhisperForConditionalGeneration.from_pretrained(modelId, { dtype: "q8", progress_callback }),
    ]);
    return { tokenizer, processor, model, device: "wasm" as const };
  }
}

async function load() {
  try {
    runtime ??= await loadRuntime();
    await runtime.model.generate({ input_features: full([1, 80, 3000], 0), max_new_tokens: 1 });
    send({ type: "ready", device: runtime.device });
  } catch {
    send({ type: "error", message: "無法載入本機語音模型。" });
  }
}

async function transcribe(request: Extract<AsrWorkerRequest, { type: "transcribe" }>) {
  if (processing) { send({ type: "error", requestId: request.requestId, message: "上一段語音仍在轉錄。" }); return; }
  processing = true; send({ type: "transcribing", requestId: request.requestId });
  try {
    runtime ??= await loadRuntime();
    const audio = request.audio.slice(Math.max(0, request.audio.length - maxSamples));
    let partial = "";
    const streamer = new TextStreamer(runtime.tokenizer, { skip_prompt: true, skip_special_tokens: true, callback_function: (text: string) => { partial += text; send({ type: "partial", requestId: request.requestId, text: partial }); } });
    const inputs = await runtime.processor(audio);
    const output = await runtime.model.generate({ ...inputs, max_new_tokens: 64, language: request.language as VoiceLanguage, streamer });
    const decoded = runtime.tokenizer.batch_decode(output as never, { skip_special_tokens: true })[0] ?? partial;
    send({ type: "complete", requestId: request.requestId, text: decoded });
  } catch {
    send({ type: "error", requestId: request.requestId, message: "本機轉錄失敗，請再試一次。" });
  } finally { processing = false; }
}

self.addEventListener("message", (event: MessageEvent<AsrWorkerRequest>) => {
  if (!event.data || typeof event.data !== "object") return;
  if (event.data.type === "load") void load();
  if (event.data.type === "transcribe") void transcribe(event.data);
});
