"use client";

import * as faceapi from "face-api.js";
import { getSettings } from "@/lib/storage";
import type { Student } from "@/types";

export const MODELS_URL = "/models";

export type FacePoint = { x: number; y: number };

export type FaceDetectionResult = faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>
>;

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

function assertClient(): void {
  if (typeof window === "undefined") {
    throw new Error("faceRecognition can only run in the browser");
  }
}

function pointDistance(a: FacePoint, b: FacePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export async function loadModels(): Promise<void> {
  assertClient();

  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);
    console.log("[faceRecognition] ssdMobilenetv1 loaded");

    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
    console.log("[faceRecognition] faceLandmark68Net loaded");

    await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
    console.log("[faceRecognition] faceRecognitionNet loaded");

    modelsLoaded = true;
    modelsLoading = null;
  })();

  return modelsLoading;
}

export async function detectFace(
  video: HTMLVideoElement
): Promise<FaceDetectionResult | null> {
  assertClient();
  await loadModels();

  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ?? null;
}

export async function getFaceDescriptor(
  video: HTMLVideoElement
): Promise<number[] | null> {
  const detection = await detectFace(video);
  if (!detection?.descriptor) return null;
  return Array.from(detection.descriptor);
}

export function matchFace(
  descriptor: number[],
  students: Student[]
): { student: Student; distance: number; confidence: number } | null {
  assertClient();

  const settings = getSettings();
  const threshold = settings.faceMatchThreshold ?? 0.5;
  const query = new Float32Array(descriptor);

  const enrolled = students.filter((s) => s.faceDescriptor && s.isActive);
  if (enrolled.length === 0) return null;

  let best: { student: Student; distance: number } | null = null;

  for (const student of enrolled) {
    const stored = new Float32Array(student.faceDescriptor!);
    const distance = faceapi.euclideanDistance(query, stored);
    if (!best || distance < best.distance) {
      best = { student, distance };
    }
  }

  if (!best || best.distance >= threshold) return null;

  return {
    student: best.student,
    distance: best.distance,
    confidence: Math.round((1 - best.distance) * 100),
  };
}

export function drawFaceOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detection: FaceDetectionResult,
  label: string,
  color: string
): void {
  assertClient();

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = video.videoWidth || video.clientWidth;
  canvas.height = video.videoHeight || video.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const displaySize = { width: canvas.width, height: canvas.height };
  faceapi.matchDimensions(canvas, displaySize);

  const resized = faceapi.resizeResults(detection, displaySize);
  const box = resized.detection.box;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  ctx.fillStyle = color;
  ctx.font = "bold 14px system-ui, sans-serif";
  const padding = 6;
  const textWidth = ctx.measureText(label).width;
  const labelY = Math.max(box.y - 8, 20);

  ctx.fillRect(box.x, labelY - 18, textWidth + padding * 2, 22);
  ctx.fillStyle = "#0a0a0f";
  ctx.fillText(label, box.x + padding, labelY - 2);
}

export function getEyeLandmarks(
  landmarks: faceapi.FaceLandmarks68
): { left: FacePoint[]; right: FacePoint[] } {
  const positions = landmarks.positions;
  const left = [36, 37, 38, 39, 40, 41].map((i) => ({
    x: positions[i].x,
    y: positions[i].y,
  }));
  const right = [42, 43, 44, 45, 46, 47].map((i) => ({
    x: positions[i].x,
    y: positions[i].y,
  }));
  return { left, right };
}

export function calculateEAR(eyePoints: FacePoint[]): number {
  if (eyePoints.length < 6) return 0;

  const vertical1 = pointDistance(eyePoints[1], eyePoints[5]);
  const vertical2 = pointDistance(eyePoints[2], eyePoints[4]);
  const horizontal = pointDistance(eyePoints[0], eyePoints[3]);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export function calculateCombinedEAR(
  landmarks: faceapi.FaceLandmarks68
): number {
  const { left, right } = getEyeLandmarks(landmarks);
  return (calculateEAR(left) + calculateEAR(right)) / 2;
}
