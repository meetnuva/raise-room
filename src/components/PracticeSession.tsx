import type { ReactNode } from "react";
import type { AsrModelPresetId } from "../domain/asr-models";
import { useLocalVoice } from "../hooks/use-local-voice";
import { usePracticeMedia, type PracticeMediaController } from "../runtime/use-practice-media";

export interface PracticeRuntime {
  media: PracticeMediaController;
  voice: ReturnType<typeof useLocalVoice>;
}

export function PracticeSession({
  modelPreset,
  children,
}: {
  modelPreset: AsrModelPresetId;
  children(runtime: PracticeRuntime): ReactNode;
}) {
  const media = usePracticeMedia();
  const voice = useLocalVoice({ modelPreset, sharedAudioStream: media.stream });

  return <>{children({ media, voice })}</>;
}
