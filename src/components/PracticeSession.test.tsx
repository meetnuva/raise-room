import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PracticeSession } from "./PracticeSession";

const hooks = vi.hoisted(() => ({
  mediaMount: vi.fn(),
  mediaCleanup: vi.fn(),
  voiceMount: vi.fn(),
  voiceCleanup: vi.fn(),
  voiceInput: vi.fn(),
  media: { stream: { id: "shared-stream" } as MediaStream },
  voice: { status: "idle" },
}));

vi.mock("../runtime/use-practice-media", () => ({
  usePracticeMedia: () => {
    useEffect(() => {
      hooks.mediaMount();
      return () => hooks.mediaCleanup();
    }, []);
    return hooks.media;
  },
}));

vi.mock("../hooks/use-local-voice", () => ({
  useLocalVoice: (input: unknown) => {
    hooks.voiceInput(input);
    useEffect(() => {
      hooks.voiceMount();
      return () => hooks.voiceCleanup();
    }, []);
    return hooks.voice;
  },
}));

function Harness({ phase }: { phase: "lobby" | "meeting" }) {
  return (
    <PracticeSession modelPreset="quality">
      {({ media, voice }) => <output>{`${phase}:${media.stream?.id}:${voice.status}`}</output>}
    </PracticeSession>
  );
}

test("keeps media and voice owners mounted while the child changes from lobby to meeting", () => {
  const { rerender, unmount } = render(<Harness phase="lobby" />);
  expect(screen.getByText("lobby:shared-stream:idle")).toBeVisible();
  expect(hooks.mediaMount).toHaveBeenCalledTimes(1);
  expect(hooks.voiceMount).toHaveBeenCalledTimes(1);
  expect(hooks.voiceInput).toHaveBeenLastCalledWith({ modelPreset: "quality", sharedAudioStream: hooks.media.stream });

  rerender(<Harness phase="meeting" />);
  expect(screen.getByText("meeting:shared-stream:idle")).toBeVisible();
  expect(hooks.mediaMount).toHaveBeenCalledTimes(1);
  expect(hooks.voiceMount).toHaveBeenCalledTimes(1);
  expect(hooks.mediaCleanup).not.toHaveBeenCalled();
  expect(hooks.voiceCleanup).not.toHaveBeenCalled();

  unmount();
  expect(hooks.mediaCleanup).toHaveBeenCalledTimes(1);
  expect(hooks.voiceCleanup).toHaveBeenCalledTimes(1);
});
