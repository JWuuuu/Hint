export type ActivityId = 'idle' | 'listening' | 'thinking' | 'reading' | 'speaking' | 'waiting';
export type GestureId = ActivityId | 'welcome' | 'welcome-back' | 'acknowledge' | 'reassure' | 'present-card' | 'offer-letter' | 'wink-left' | 'wink-right' | 'nod' | 'shake-head' | 'celebration' | 'curious' | 'surprised' | 'shy' | 'comfort' | 'disappointed' | 'frustrated' | 'sleepy';
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
  headYaw: number; headPitch: number; headRoll: number; crouch: number;
  squash: number; scale: number; breath: number; scarfLag?: number;
  eyeLeft: number; eyeRight: number; gazeX: number; gazeY: number; engage: number;
  thought: number; joy: number; attention: number; assurance: number;
  playful: number; playfulSide: number; expectant: number;
  wide: number; soft: number; round: number; speech: number; reading: number;
  shy: number; sad: number; grumpy: number; tired: number; yawn: number;
  pawThink: number; pawOpen: number; pawCelebrate: number; pawHug: number; pawDip: number;
  pawReach: number; pawWave: number; waveTime: number;
  pawFold: number; pawRest: number;
  question: number; sparkles: number;
}
export interface PawDrawing { center: [number, number]; points: [number, number][]; }
export interface PawFrame extends PawDrawing {
  side: 'left' | 'right';
  layers?: {texture: string; uv: PawDrawing; weight: number}[];
}
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

export interface HintSceneContext {
  room: 'ask' | 'voice' | 'away' | 'welcome' | 'profile' | 'home';
  introduction?: boolean;
  revealing?: boolean;
  phase: 'idle' | 'waiting' | 'starting' | 'listening' | 'thinking' | 'preparing' | 'speaking' | 'reading' | 'paused' | 'error';
  hasMessages: boolean;
  keyboardOpen: boolean;
  typing: boolean;
  audioPlaying: boolean;
}
export interface HintSceneState {
  context: HintSceneContext;
  activity: ActivityId;
  activityTime: number;
  clock: number;
  phase: 'gesture' | 'entering' | 'arriving' | 'holding' | 'introduction' | 'delivery';
  letter: LetterState;
  placement: 'welcome' | 'avatar' | 'voice' | 'away';
  gesture: GestureId | null;
  reaction: 'wink-left' | 'wink-right' | null;
  paused: boolean;
  reducedMotion: boolean;
  visible: boolean;
  speed: number;
  transitioning: boolean;
  speaking: boolean;
  accentsVisible: boolean;
  destroyed: boolean;
}
export interface HintSceneFrame {
  state: HintSceneState;
  pose: HintPose;
  paws?: PawFrame[];
  actor: {x: number; y: number; width: number; height: number};
  look: {x: number; y: number};
  gesture: MotionId;
  gestureTime: number;
  shadow: {x: number; y: number; width: number; opacity: number};
  fallback?: boolean;
  delivery?: {key: string; phase: string; time: number; handoff: number} | null;
  letter: LetterState;
  intro: null | {time: number; phase: string; skyFade: number; logoOpacity: number; bubble: number;
    maskY: number; actor: {opacity: number; front: boolean}; logo: {x: number; y: number; width: number};
    shadow: {opacity: number; scale: number}};
}
export interface HintScenePlayer {
  setDelivery(delivery: {key: string; cardBack: string; card: {x: number; y: number; width: number; height: number}; done?: boolean} | null): void;
  setContext(context: Partial<HintSceneContext>): boolean;
  setAnchor(anchor: {x: number; y: number; width: number}, options?: {followLayout?: boolean}): boolean;
  react(): boolean;
  playGesture(id: GestureId, options?: {interrupt?: boolean}): boolean;
  pause(): void;
  resume(): void;
  setMotionPolicy(policy: {reduced?: boolean; visible?: boolean}): void;
  setSpeed(value: number): void;
  setAccentsVisible(value: boolean): void;
  getState(): HintSceneState;
  getFrame(): HintSceneFrame;
  destroy(): void;
}
export interface HintSceneDirector extends Omit<HintScenePlayer, 'getFrame' | 'setDelivery'> {
  setDelivery(delivery: {key: string; card: {x: number; y: number; width: number; height: number}; ready: boolean; done?: boolean} | null): void;
  sample(): HintSceneFrame;
  advance(seconds: number): void;
  setViewport(width: number, height: number): void;
  setPointer(x: number, y: number): void;
}
export function createHintSceneDirector(options?: {context?: Partial<HintSceneContext>; letterGeometry?: HintAssets['letterGeometry']; pawGeometry?: HintAssets; onComplete?: (result: {gesture: GestureId}) => void}): HintSceneDirector;
export function describeHintContext(context: Partial<HintSceneContext>): {activity: ActivityId; placement: HintSceneState['placement']; frozen: boolean; speaking: boolean};
export function createHintScenePlayer(canvas: HTMLCanvasElement, options: {
  assets: HintAssets;
  context?: Partial<HintSceneContext>;
  pointerTarget?: HTMLElement;
  motionPolicy?: {reduced?: boolean; visible?: boolean};
  onFrame?: (frame: HintSceneFrame) => void;
  onPerformance?: (timing: {sampleMs: number; renderMs: number}) => void;
  onComplete?: (result: {gesture: GestureId}) => void;
  onRendererState?: (state: 'ready' | 'unavailable') => void;
  onError?: (error: unknown) => void;
}): Promise<HintScenePlayer>;
export function createJourneySky(canvas: HTMLCanvasElement): {draw(time: number, fade?: number): void; resize(width: number, height: number): void};
