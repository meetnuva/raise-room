import { useLocalVision } from "../hooks/use-local-vision";

type Props = {
  vision?: ReturnType<typeof useLocalVision>;
  cameraActive: boolean;
};

type ViewProps = Required<Props>;

function LocalVisualControlView({ vision, cameraActive }: ViewProps) {
  if (vision.status === "idle") {
    return (
      <section className="local-visual-control" aria-label="本機視覺觀察">
        <p>模型檔首次下載；畫面不會上傳</p>
        <button type="button" onClick={vision.loadModel}>載入本機視覺模型</button>
        <p className="vision-disclaimer">只看畫面幾何，不判斷情緒、誠實或自信</p>
      </section>
    );
  }

  if (vision.status === "loading-model") {
    const message = vision.progress === null
      ? "正在載入本機視覺模型"
      : `正在下載模型 ${Math.round(vision.progress * 100)}%`;
    return <section className="local-visual-control" role="status"><p>{message}</p><p>畫面不會上傳。</p></section>;
  }

  if (vision.status === "ready") {
    return (
      <section className="local-visual-control">
        {vision.errorMessage && <p role="status">⚠ {vision.errorMessage}</p>}
        <button
          type="button"
          disabled={!cameraActive}
          onClick={vision.startObserving}
        >
          {cameraActive ? "開始本機視覺觀察" : "請先開啟鏡頭"}
        </button>
        <p className="vision-disclaimer">只看畫面幾何，不判斷情緒、誠實或自信</p>
      </section>
    );
  }

  if (vision.status === "observing") {
    return (
      <section className="local-visual-control" role="status">
        <strong>視覺觀察中</strong>
        <p>{vision.lastObservation?.hasFace ? "目前偵測到單一臉部" : "目前未偵測到單一臉部"}</p>
        <p>樣本數：{vision.signals.sampleCount}</p>
        <button type="button" onClick={vision.stopObserving}>停止觀察</button>
        <p className="vision-disclaimer">只看畫面幾何，不判斷情緒、誠實或自信</p>
      </section>
    );
  }

  return (
    <section className="local-visual-control" role="status">
      <p>{vision.errorMessage ?? "此瀏覽器無法使用本機視覺觀察。"}</p>
      <p className="vision-disclaimer">只看畫面幾何，不判斷情緒、誠實或自信</p>
    </section>
  );
}

function OwnedLocalVisualControl({ cameraActive }: Omit<Props, "vision">) {
  const vision = useLocalVision({ videoElement: null });
  return <LocalVisualControlView vision={vision} cameraActive={cameraActive} />;
}

export function LocalVisualControl(props: Props) {
  if (props.vision) return <LocalVisualControlView vision={props.vision} cameraActive={props.cameraActive} />;
  return <OwnedLocalVisualControl cameraActive={props.cameraActive} />;
}
