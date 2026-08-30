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
  selectedDeviceIds,
  children,
}: {
  modelPreset: AsrModelPresetId;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  children(runtime: PracticeRuntime): ReactNode;
}) {
  const media = usePracticeMedia({ selectedDeviceIds });
  const voice = useLocalVoice({ modelPreset, sharedAudioStream: media.stream });

  return <>{children({ media, voice })}</>;
}
