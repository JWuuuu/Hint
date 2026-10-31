export type ActivityId = 'idle' | 'listening' | 'thinking' | 'reading' | 'speaking' | 'waiting';
export type GestureId = ActivityId | 'welcome' | 'offer-letter' | 'wink-left' | 'wink-right' | 'nod' | 'shake-head' | 'celebration' | 'curious' | 'surprised' | 'shy' | 'comfort' | 'disappointed' | 'frustrated' | 'sleepy';
export type MotionId = GestureId | 'deliver-letter';
export type LetterState = 'held' | 'offered' | 'delivered';
export type ActivityPhase = 'entering' | 'holding' | 'exiting' | 'gesture' | 'offered' | 'settled';
export interface LetterTarget { x: number; y: number; scale?: number; angle?: number; }
export interface HintState {
  gesture: MotionId; activity: ActivityId; mode: 'activity' | 'gesture'; phase: ActivityPhase;
  time: number; activityTime: number; clock: number; duration: number;
  active: boolean; paused: boolean; transitioning: boolean; queuedActivity: ActivityId | null;
  letter: LetterState; letterOwner: 'mascot' | 'reader';
  letterTarget: LetterTarget; handoffFired: boolean;
  speed: number; reducedMotion: boolean; visible: boolean; accentsVisible: boolean;
}
export interface HintPose {
  x: number; y: number; roll: number; head: number; lean: number; turn: number;
  squash: number; scale: number; breath: number;
  eyeLeft: number; eyeRight: number; gazeX: number; gazeY: number; engage: number;
  thought: number; joy: number; attention: number; assurance: number;
  playful: number; playfulSide: number; expectant: number;
  wide: number; soft: number; round: number; speech: number; reading: number;
  shy: number; sad: number; grumpy: number; tired: number; yawn: number;
  pawThink: number; pawOpen: number; pawCelebrate: number; pawHug: number; pawDip: number;
  pawReach: number; pawWave: number; waveTime: number;
  question: number; sparkles: number;
}
export interface PawDrawing { center: [number, number]; points: [number, number][]; }
export interface HintAssets {
  images: Record<string, string>;
  geometry: {root: [number, number]; segments: number; poses: (PawDrawing & {angle: number; radius: number; local: [number, number][]})[]};
  letterGeometry: {segments: number; left: PawDrawing[]; right: PawDrawing[]};
  expressionGeometry: {wave: PawDrawing[]; connected: Record<string, PawDrawing & {side: 'left' | 'right'; uv: PawDrawing; texture: string}>};
}
export interface HintMascot {
  playGesture(gesture: GestureId): boolean;
  setActivity(activity: ActivityId): boolean;
  acceptLetter(): boolean;
  resetScene(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  setSpeed(speed: number): void;
  setAccentsVisible(visible: boolean): void;
  getState(): HintState;
  getPose(): HintPose;
  destroy(): void;
}
export function createHintMascot(canvas: HTMLCanvasElement, options: {
  assets: HintAssets;
  letterTarget?: LetterTarget;
  onUpdate?: (state: HintState, pose: HintPose) => void;
  onComplete?: (result: {gesture: MotionId; letter: LetterState}) => void;
  onActivityChange?: (result: {activity: ActivityId; phase: ActivityPhase}) => void;
  onLetterHandoff?: (result: {letter: 'delivered'; target: LetterTarget}) => void;
}): Promise<HintMascot>;
export const activities: ActivityId[];
export const gestures: Record<MotionId, {label: string; title: string; duration: number; tracks: Record<string, [number, number][]>}>;
