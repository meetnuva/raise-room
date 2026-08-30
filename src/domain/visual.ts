export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface VisualFrameObservation {
  timestampMs: number;
  hasFace: boolean;
  faceCenterX: number | null;
  faceCenterY: number | null;
  faceAreaRatio: number | null;
  irisHorizontalOffset: number | null;
}

export interface VisualAggregate {
  sampleCount: number;
  faceVisibleCount: number;
  centeredCount: number;
  stableDistanceCount: number;
  cameraDirectionCount: number;
  cameraDirectionEligibleCount: number;
}

export interface VisualSignals {
  sampleCount: number;
  faceVisibleRatio: number | null;
  centeredRatio: number | null;
  stableDistanceRatio: number | null;
  cameraDirectionEstimateRatio: number | null;
}

function isFinitePoint(value: LandmarkPoint | undefined): value is LandmarkPoint {
  return value !== undefined && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function noFace(timestampMs: number): VisualFrameObservation {
  return {
    timestampMs,
    hasFace: false,
    faceCenterX: null,
    faceCenterY: null,
    faceAreaRatio: null,
    irisHorizontalOffset: null,
  };
}

function irisOffset(landmarks: LandmarkPoint[]): number | null {
  if (landmarks.length < 478) return null;

  const eyeOffset = (firstIrisIndex: number, firstCorner: number, secondCorner: number) => {
    const iris = landmarks.slice(firstIrisIndex, firstIrisIndex + 5);
    const start = landmarks[firstCorner];
    const end = landmarks[secondCorner];
    if (!iris.every(isFinitePoint) || !isFinitePoint(start) || !isFinitePoint(end) || start.x === end.x) {
      return null;
    }

    const meanX = iris.reduce((sum, point) => sum + point.x, 0) / iris.length;
    const position = (meanX - Math.min(start.x, end.x)) / Math.abs(end.x - start.x);
    return Math.abs(position - 0.5) * 2;
  };

  const left = eyeOffset(468, 33, 133);
  const right = eyeOffset(473, 362, 263);
  return left === null || right === null ? null : Math.min(1, Math.max(0, (left + right) / 2));
}

export function extractVisualObservation(
  timestampMs: number,
  landmarks: LandmarkPoint[] | undefined,
): VisualFrameObservation {
  if (!landmarks) return noFace(timestampMs);
  const finitePoints = landmarks.filter(isFinitePoint);
  if (finitePoints.length < 2) return noFace(timestampMs);

  const xs = finitePoints.map((point) => point.x);
  const ys = finitePoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    timestampMs,
    hasFace: true,
    faceCenterX: (minX + maxX) / 2,
    faceCenterY: (minY + maxY) / 2,
    faceAreaRatio: (maxX - minX) * (maxY - minY),
    irisHorizontalOffset: irisOffset(landmarks),
  };
}

export function createVisualAggregate(): VisualAggregate {
  return {
    sampleCount: 0,
    faceVisibleCount: 0,
    centeredCount: 0,
    stableDistanceCount: 0,
    cameraDirectionCount: 0,
    cameraDirectionEligibleCount: 0,
  };
}

export function addVisualObservation(
  aggregate: VisualAggregate,
  observation: VisualFrameObservation,
): VisualAggregate {
  const hasFace = observation.hasFace;
  const centered = hasFace
    && observation.faceCenterX !== null
    && observation.faceCenterY !== null
    && observation.faceCenterX >= 0.35
    && observation.faceCenterX <= 0.65
    && observation.faceCenterY >= 0.25
    && observation.faceCenterY <= 0.65;
  const stableDistance = hasFace
    && observation.faceAreaRatio !== null
    && observation.faceAreaRatio >= 0.08
    && observation.faceAreaRatio <= 0.45;
  const irisHorizontalOffset = observation.irisHorizontalOffset;
  const cameraDirectionEligible = hasFace && irisHorizontalOffset !== null;
  const cameraDirection = cameraDirectionEligible && irisHorizontalOffset !== null && irisHorizontalOffset <= 0.35;

  return {
    sampleCount: aggregate.sampleCount + 1,
    faceVisibleCount: aggregate.faceVisibleCount + Number(hasFace),
    centeredCount: aggregate.centeredCount + Number(centered),
    stableDistanceCount: aggregate.stableDistanceCount + Number(stableDistance),
    cameraDirectionCount: aggregate.cameraDirectionCount + Number(cameraDirection),
    cameraDirectionEligibleCount: aggregate.cameraDirectionEligibleCount + Number(cameraDirectionEligible),
  };
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.min(1, Math.max(0, numerator / denominator));
}

export function toVisualSignals(aggregate: VisualAggregate): VisualSignals {
  return {
    sampleCount: aggregate.sampleCount,
    faceVisibleRatio: ratio(aggregate.faceVisibleCount, aggregate.sampleCount),
    centeredRatio: ratio(aggregate.centeredCount, aggregate.sampleCount),
    stableDistanceRatio: ratio(aggregate.stableDistanceCount, aggregate.sampleCount),
    cameraDirectionEstimateRatio: ratio(
      aggregate.cameraDirectionCount,
      aggregate.cameraDirectionEligibleCount,
    ),
  };
}
