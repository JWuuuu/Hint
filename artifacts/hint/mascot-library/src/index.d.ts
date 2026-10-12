export type GestureId = 'wink-left' | 'wink-right' | 'nod' | 'listening' | 'thinking' | 'celebration' | 'offer-letter';
export type MotionId = GestureId | 'deliver-letter';
export type LetterState = 'held' | 'offered' | 'delivered';
export interface HintState {
  gesture: MotionId;
  time: number;
  clock: number;
  duration: number;
  active: boolean;
  paused: boolean;
  letter: LetterState;
  speed: number;
  reducedMotion: boolean;
  visible: boolean;
}
export interface HintPose {
  x: number; y: number; roll: number; head: number; squash: number; scale: number;
  eyeLeft: number; eyeRight: number; gazeX: number; gazeY: number; engage: number;
}
export interface PawDrawing {
  center: [number, number];
  points: [number, number][];
}
export interface HintAssets {
  images: Record<string, string>;
  letterGeometry: { segments: number; left: PawDrawing[]; right: PawDrawing[] };
}
export interface HintMascot {
  playGesture(gesture: GestureId): boolean;
  acceptLetter(): boolean;
  resetScene(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  setSpeed(speed: number): void;
  getState(): HintState;
  getPose(): HintPose;
  destroy(): void;
}
export function createHintMascot(canvas: HTMLCanvasElement, options: {
  assets: HintAssets;
  onUpdate?: (state: HintState, pose: HintPose) => void;
  onComplete?: (result: { gesture: MotionId; letter: LetterState }) => void;
}): Promise<HintMascot>;
export const gestures: Record<MotionId, { label: string; title: string; duration: number; tracks: Record<string, [number, number][]> }>;
