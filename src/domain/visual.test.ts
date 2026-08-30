import { describe, expect, test } from "vitest";
import {
  addVisualObservation,
  createVisualAggregate,
  extractVisualObservation,
  toVisualSignals,
} from "./visual";

describe("extractVisualObservation", () => {
  test("marks an absent or malformed face without emitting geometry", () => {
    expect(extractVisualObservation(100, undefined)).toEqual({
      timestampMs: 100,
      hasFace: false,
      faceCenterX: null,
      faceCenterY: null,
      faceAreaRatio: null,
      irisHorizontalOffset: null,
    });
    expect(extractVisualObservation(101, [{ x: Number.NaN, y: 0 }])).toMatchObject({ hasFace: false });
  });

  test("derives bounds, center, and area from finite landmarks", () => {
    const observation = extractVisualObservation(100, [
      { x: 0.2, y: 0.3 },
      { x: 0.6, y: 0.7 },
    ]);
    expect(observation).toMatchObject({
      timestampMs: 100,
      hasFace: true,
      faceCenterX: 0.4,
      faceCenterY: 0.5,
      irisHorizontalOffset: null,
    });
    expect(observation.faceAreaRatio).toBeCloseTo(0.16);
  });

  test("derives a normalized iris offset only when all iris points exist", () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    landmarks[33] = { x: 0.2, y: 0.5 };
    landmarks[133] = { x: 0.4, y: 0.5 };
    landmarks[362] = { x: 0.6, y: 0.5 };
    landmarks[263] = { x: 0.8, y: 0.5 };
    for (let index = 468; index <= 472; index += 1) landmarks[index] = { x: 0.3, y: 0.5 };
    for (let index = 473; index <= 477; index += 1) landmarks[index] = { x: 0.7, y: 0.5 };

    expect(extractVisualObservation(100, landmarks).irisHorizontalOffset).toBeCloseTo(0);
  });
});

describe("visual aggregates", () => {
  test("keeps only aggregate counts and uses the documented denominators", () => {
    let aggregate = createVisualAggregate();
    aggregate = addVisualObservation(aggregate, {
      timestampMs: 1,
      hasFace: true,
      faceCenterX: 0.5,
      faceCenterY: 0.5,
      faceAreaRatio: 0.2,
      irisHorizontalOffset: 0.2,
    });
    aggregate = addVisualObservation(aggregate, {
      timestampMs: 2,
      hasFace: true,
      faceCenterX: 0.7,
      faceCenterY: 0.5,
      faceAreaRatio: 0.6,
      irisHorizontalOffset: 0.5,
    });
    aggregate = addVisualObservation(aggregate, {
      timestampMs: 3,
      hasFace: false,
      faceCenterX: null,
      faceCenterY: null,
      faceAreaRatio: null,
      irisHorizontalOffset: null,
    });

    expect(aggregate).toEqual({
      sampleCount: 3,
      faceVisibleCount: 2,
      centeredCount: 1,
      stableDistanceCount: 1,
      cameraDirectionCount: 1,
      cameraDirectionEligibleCount: 2,
    });
    expect(toVisualSignals(aggregate)).toEqual({
      sampleCount: 3,
      faceVisibleRatio: 2 / 3,
      centeredRatio: 1 / 3,
      stableDistanceRatio: 1 / 3,
      cameraDirectionEstimateRatio: 0.5,
    });
  });

  test("returns null ratios when there is no denominator", () => {
    expect(toVisualSignals(createVisualAggregate())).toEqual({
      sampleCount: 0,
      faceVisibleRatio: null,
      centeredRatio: null,
      stableDistanceRatio: null,
      cameraDirectionEstimateRatio: null,
    });
  });
});
