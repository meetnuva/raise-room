import {
  AutoProcessor,
  AutoTokenizer,
  full,
  TextStreamer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import { isAsrModelPresetId, type AsrModelPresetId } from "../domain/asr-models";
import { getAsrRuntimeConfig } from "../lib/asr-runtime-config";
import { normalizeAsrProgress, type AsrWorkerRequest, type VoiceLanguage } from "../lib/local-asr";

const maxSamples = 16000 * 30;
let processing = false;

type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
let runtime: Runtime | null = null;
let activePreset: AsrModelPresetId | null = null;

function send(message: unknown) {
  self.postMessage(message);
}

function loading(progress: unknown) {
  const value = progress as { progress?: unknown; status?: unknown; file?: unknown };
  const message =
    typeof value.file === "string"
      ? value.file
      : typeof value.status === "string"
        ? value.status
        : "正在載入本機模型";

  send({
    type: "loading",
    progress: normalizeAsrProgress(value.progress),
    message,
  });
}

function hasWebGpu() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function loadRuntime(preset: AsrModelPresetId) {
  const progress_callback = loading;
  const config = getAsrRuntimeConfig(preset, hasWebGpu());
  if (!config.ok) throw new Error(config.message);
  const [tokenizer, processor, model] = await Promise.all([
    AutoTokenizer.from_pretrained(config.modelId, { progress_callback }),
    AutoProcessor.from_pretrained(config.modelId, { progress_callback }),
    WhisperForConditionalGeneration.from_pretrained(config.modelId, {
      device: config.device,
      dtype: config.dtype,
      progress_callback,
    }),
  ]);

  return { tokenizer, processor, model, device: config.device };
}

async function closeRuntime() {
  const model = runtime?.model as { dispose?: () => void | Promise<void> } | undefined;
  await model?.dispose?.();
  runtime = null;
  activePreset = null;
}

async function load(preset: AsrModelPresetId) {
  try {
    if (activePreset !== preset) await closeRuntime();
    runtime ??= await loadRuntime(preset);
    activePreset = preset;
    await runtime.model.generate({ input_features: full([1, 80, 3000], 0), max_new_tokens: 1 });
    send({ type: "ready", device: runtime.device });
  } catch (error) {
    send({ type: "error", message: error instanceof Error ? error.message : "無法載入本機語音模型。" });
  }
}

async function transcribe(request: Extract<AsrWorkerRequest, { type: "transcribe" }>) {
  if (processing) {
    send({
      type: "error",
      requestId: request.requestId,
      message: "上一段語音仍在轉錄。",
    });
    return;
  }

  processing = true;
  send({ type: "transcribing", requestId: request.requestId });

  try {
    if (!isAsrModelPresetId(request.preset)) throw new Error("不支援的語音模型設定。");
    if (activePreset !== request.preset || !runtime) {
      await load(request.preset);
      if (!runtime || activePreset !== request.preset) throw new Error("無法載入本機語音模型。");
    }
    const audio = request.audio.slice(Math.max(0, request.audio.length - maxSamples));
    let partial = "";
    const streamer = new TextStreamer(runtime.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        partial += text;
        send({ type: "partial", requestId: request.requestId, text: partial });
      },
    });
    const inputs = await runtime.processor(audio);
    const output = await runtime.model.generate({
      ...inputs,
      max_new_tokens: 64,
      language: request.language as VoiceLanguage,
      streamer,
    });
    const decoded = runtime.tokenizer.batch_decode(output as never, { skip_special_tokens: true })[0] ?? partial;

    send({ type: "complete", requestId: request.requestId, text: decoded });
  } catch {
    send({ type: "error", requestId: request.requestId, message: "本機轉錄失敗，請再試一次。" });
  } finally {
    processing = false;
  }
}

self.addEventListener("message", (event: MessageEvent<AsrWorkerRequest>) => {
  if (!event.data || typeof event.data !== "object") return;
  if (event.data.type === "load" && isAsrModelPresetId(event.data.preset)) void load(event.data.preset);
  if (event.data.type === "transcribe") void transcribe(event.data);
  if (event.data.type === "close") void closeRuntime();
});
