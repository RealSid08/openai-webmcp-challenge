import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import '@babylonjs/core/Collisions/collisionCoordinator';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';

import type { AppServices } from '../app/createAppServices';
import { ProceduralAudio } from '../audio/ProceduralAudio';
import { InputManager, type InputFrame } from './input/InputManager';
import {
  chooseAimAssistTarget,
  computeAimAssistCorrection,
  type AimAssistCandidate,
} from './input/aimAssist';
import type { InputDevice } from './input/inputBindings';
import { PointerLockController, type PointerLockSnapshot } from './input/PointerLockController';
import type { CharacterId, MissionSection } from './MissionStore';
import { RuntimeVisualFactory, type RuntimeEnemy } from './RuntimeVisualFactory';
import {
  choosePrioritizedTarget,
  shouldAdvanceMissionSimulation,
  shouldHoldForAgentTurn,
} from './runtimeLogic';
import { PlayerMotor } from './systems/PlayerMotor';
import { CHASE_ROUTE, FACILITY_LAYOUT, type WorldPoint } from './worldLayout';
import { TutorialDirector, type TutorialSnapshot } from '../tutorial/TutorialDirector';

export interface GameRuntimeStatus {
  enemiesRemaining: number;
  chaseProgress: number;
  prompt: string | null;
  pointerLocked: boolean;
  pointerLock: PointerLockSnapshot;
  inputDevice: InputDevice;
  tutorial: TutorialSnapshot;
}

interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  services: AppServices;
  onStatus: (status: GameRuntimeStatus) => void;
}

interface TurnRuntime {
  evaluated: boolean;
  humanAction: 'LEFT' | 'RIGHT' | 'HOLD';
}

const FACILITY_SECTIONS = new Set<MissionSection>([
  'FACILITY_ONE',
  'FACILITY_TWO',
  'BOMB_GATE',
]);

export class BabylonGameRuntime {
  private readonly engine: Engine;
  private scene: Scene;
  private camera: UniversalCamera;
  private visualFactory: RuntimeVisualFactory;
  private partnerMesh: Mesh | null = null;
  private gateMesh: Mesh | null = null;
  private carMesh: Mesh | null = null;
  private enemies: RuntimeEnemy[] = [];
  private pursuers: RuntimeEnemy[] = [];
  private currentSection: MissionSection | null = null;
  private representedHuman: CharacterId;
  private readonly characterPositions: Record<CharacterId, Vector3> = {
    OWEN: new Vector3(-3.5, 1.7, 1),
    CODY: new Vector3(2.5, 1.7, 2),
  };
  private readonly pressed = new Set<string>();
  private readonly turnState = new Map<1 | 2, TurnRuntime>();
  private readonly prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly audio = new ProceduralAudio();
  private readonly pointerLock: PointerLockController;
  private readonly input: InputManager;
  private readonly playerMotor = new PlayerMotor();
  private readonly tutorial: TutorialDirector;
  private lastInputFrame: InputFrame = {
    device: 'KEYBOARD_MOUSE',
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    aim: 0,
    fire: 0,
    reloadPressed: false,
    interactPressed: false,
    switchPressed: false,
    calloutPressed: false,
    pausePressed: false,
    skipTrainingHeld: false,
    sprinting: true,
  };
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeCoordinator: (() => void) | null = null;
  private lastHistoryEventId: string | null = null;
  private lastFrameAt = performance.now();
  private lastEnemyAttackAt = 0;
  private lastPartnerShotAt = 0;
  private lastHumanShotAt = 0;
  private lastEngineCueAt = 0;
  private lastStatusAt = 0;
  private attackSequence = 0;
  private lastCameraBob = 0;
  private alarmPlayed = false;
  private encounterAdvanceAt: number | null = null;
  private plantingStartedAt: number | null = null;
  private gateOpenedAt: number | null = null;
  private chaseProgress = 0;
  private chaseLane = 0;
  private chaseCompleted = false;
  private readonly onResize = () => this.engine.resize();
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.pressed.delete(event.code);
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onContextMenu = (event: MouseEvent) => event.preventDefault();
  constructor(private readonly options: RuntimeOptions) {
    this.pointerLock = new PointerLockController(options.canvas, document);
    this.input = new InputManager();
    this.tutorial = new TutorialDirector({
      completedBefore: window.localStorage.getItem('hs-heist:tutorial-complete') === '1',
    });
    this.engine = new Engine(options.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    this.scene = new Scene(this.engine);
    this.camera = new UniversalCamera('camera', new Vector3(0, 1.7, 0), this.scene);
    this.visualFactory = new RuntimeVisualFactory(this.scene);
    this.representedHuman = options.services.store.getSnapshot().humanCharacter;
    this.lastHistoryEventId = options.services.store.getSnapshot().history.at(-1)?.id ?? null;

    this.buildForSnapshot();
    this.unsubscribeStore = options.services.store.subscribe(() => this.syncDomainState());
    this.unsubscribeCoordinator = options.services.coordinator.onEvent((event) => {
      if (['AGENT_RADIO', 'AGENT_DECISION', 'AGENT_TACTIC', 'AGENT_TARGET_PRIORITY'].includes(event.type)) {
        this.audio.play('RADIO');
      }
    });
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    options.canvas.addEventListener('pointerdown', this.onPointerDown);
    options.canvas.addEventListener('pointerup', this.onPointerUp);
    options.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.pointerLock.subscribe(() => {
      this.pressed.delete('MouseRight');
      this.emitStatus(true);
    });
    this.engine.runRenderLoop(() => this.frame());
  }

  requestControl(): Promise<PointerLockSnapshot> {
    return this.pointerLock.request();
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.unsubscribeCoordinator?.();
    this.unsubscribeCoordinator = null;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.options.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.options.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.options.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.pointerLock.release();
    this.pointerLock.dispose();
    this.input.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.audio.dispose();
  }

  private buildForSnapshot(): void {
    const snapshot = this.options.services.store.getSnapshot();
    this.lastInputFrame = this.input.poll();
    const section = snapshot.section;
    this.scene.dispose();
    this.scene = this.createBaseScene();
    this.visualFactory = new RuntimeVisualFactory(this.scene);
    this.currentSection = section;
    this.representedHuman = snapshot.humanCharacter;
    this.enemies = [];
    this.pursuers = [];
    this.partnerMesh = null;
    this.gateMesh = null;
    this.carMesh = null;
    this.encounterAdvanceAt = null;
    this.plantingStartedAt = null;
    this.gateOpenedAt = null;
    const sceneStartedAt = performance.now();
    this.lastFrameAt = sceneStartedAt;
    this.lastEnemyAttackAt = sceneStartedAt;
    this.lastPartnerShotAt = sceneStartedAt;
    this.lastEngineCueAt = sceneStartedAt;
    this.attackSequence = 0;
    this.lastCameraBob = 0;
    this.playerMotor.reset();

    if (section && FACILITY_SECTIONS.has(section)) this.buildFacility(section);
    if (section === 'CHASE') this.buildChase();
    this.emitStatus(true);
  }

  private createBaseScene(): Scene {
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.01, 0.02, 0.024, 1);
    scene.collisionsEnabled = true;
    scene.fogEnabled = true;
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.01;
    scene.fogColor = new Color3(0.04, 0.07, 0.072);
    scene.ambientColor = new Color3(0.055, 0.07, 0.062);

    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.4;
    ambient.diffuse = new Color3(0.42, 0.68, 0.72);
    ambient.groundColor = new Color3(0.1, 0.055, 0.03);
    const key = new DirectionalLight('key', new Vector3(-0.28, -1, 0.42), scene);
    key.intensity = 1.12;
    key.diffuse = new Color3(0.48, 0.86, 0.9);
    const fill = new DirectionalLight('fill', new Vector3(0.12, -0.28, -0.92), scene);
    fill.intensity = 0.42;
    fill.diffuse = new Color3(0.62, 0.3, 0.08);
    const glow = new GlowLayer('signal-glow', scene, { blurKernelSize: this.prefersReducedMotion ? 16 : 28 });
    glow.intensity = this.prefersReducedMotion ? 0.18 : 0.55;

    this.camera = new UniversalCamera('camera', new Vector3(0, 1.7, 0), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 600;
    this.camera.fov = 1.05;
    this.camera.speed = 0;
    this.camera.inertia = 0;
    this.camera.applyGravity = true;
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new Vector3(0.45, 0.85, 0.45);
    this.camera.detachControl();
    scene.activeCamera = this.camera;
    return scene;
  }

  private buildFacility(section: MissionSection): void {
    const scene = this.scene;
    const steel = this.visualFactory.material('steel', new Color3(0.07, 0.1, 0.11), 0.72);
    const darkSteel = this.visualFactory.material('dark-steel', new Color3(0.022, 0.032, 0.034), 0.88);
    const panel = this.visualFactory.material('wall-panel', new Color3(0.045, 0.062, 0.066), 0.82);
    const concrete = this.visualFactory.material('concrete', new Color3(0.08, 0.13, 0.125), 1);
    const aisle = this.visualFactory.material('aisle', new Color3(0.11, 0.16, 0.15), 0.95);
    const rust = this.visualFactory.material('rust', new Color3(0.28, 0.12, 0.04), 0.9);
    const cyan = this.visualFactory.material('cyan-signal', new Color3(0.04, 0.42, 0.44), 0.42, new Color3(0.08, 0.48, 0.5));
    const amber = this.visualFactory.material('amber-signal', new Color3(0.48, 0.24, 0.05), 0.5, new Color3(0.42, 0.16, 0.02));

    this.visualFactory.box('floor', { width: 20, height: 0.5, depth: 64 }, new Vector3(0, -0.25, 27), concrete, true);
    this.visualFactory.box('aisle', { width: 3.4, height: 0.04, depth: 62 }, new Vector3(0, 0.02, 27), aisle, false);
    this.visualFactory.box('ceiling', { width: 20, height: 0.4, depth: 64 }, new Vector3(0, 7.62, 27), darkSteel, true);
    this.visualFactory.box('left-wall', { width: 0.5, height: 8, depth: 64 }, new Vector3(-10, 3.5, 27), steel, true);
    this.visualFactory.box('right-wall', { width: 0.5, height: 8, depth: 64 }, new Vector3(10, 3.5, 27), steel, true);
    this.visualFactory.box('rear-wall', { width: 20, height: 8, depth: 0.5 }, new Vector3(0, 3.5, -4), steel, true);
    const { left: startLeft, right: startRight } = FACILITY_LAYOUT.startingCover;
    this.visualFactory.box(
      'start-cover-left',
      { width: startLeft.size.width, height: startLeft.size.height, depth: startLeft.size.depth },
      new Vector3(startLeft.center.x, startLeft.center.y, startLeft.center.z),
      panel,
      true,
    );
    this.visualFactory.box(
      'start-cover-right',
      { width: startRight.size.width, height: startRight.size.height, depth: startRight.size.depth },
      new Vector3(startRight.center.x, startRight.center.y, startRight.center.z),
      panel,
      true,
    );
    this.visualFactory.box('kick-left', { width: 0.18, height: 0.55, depth: 63 }, new Vector3(-9.68, 0.28, 27), rust, false);
    this.visualFactory.box('kick-right', { width: 0.18, height: 0.55, depth: 63 }, new Vector3(9.68, 0.28, 27), rust, false);
    this.visualFactory.box('rail-left', { width: 0.12, height: 0.08, depth: 63 }, new Vector3(-9.62, 4.15, 27), cyan, false);
    this.visualFactory.box('rail-right', { width: 0.12, height: 0.08, depth: 63 }, new Vector3(9.68, 4.15, 27), cyan, false);

    for (const z of [2, 11, 25, 36, 47]) {
      this.visualFactory.box(`roof-rib-${z}`, { width: 19.4, height: 0.28, depth: 0.42 }, new Vector3(0, 7.18, z), rust, false);
      this.visualFactory.box(`roof-beam-${z}`, { width: 0.28, height: 0.7, depth: 0.28 }, new Vector3(-6.4, 7.05, z), darkSteel, false);
      this.visualFactory.box(`roof-beam-r-${z}`, { width: 0.28, height: 0.7, depth: 0.28 }, new Vector3(6.4, 7.05, z), darkSteel, false);
      const lamp = this.visualFactory.box(`lamp-${z}`, { width: 6.2, height: 0.1, depth: 0.28 }, new Vector3(0, 6.92, z), cyan, false);
      lamp.isPickable = false;
      const light = new PointLight(`lamp-light-${z}`, new Vector3(0, 6.45, z), scene);
      light.diffuse = new Color3(0.38, 0.88, 0.9);
      light.intensity = 0.92;
      light.range = 18;
    }

    this.visualFactory.box('pipe-main', { width: 0.22, height: 0.22, depth: 58 }, new Vector3(-7.6, 6.55, 27), rust, false);
    this.visualFactory.box('pipe-aux', { width: 0.14, height: 0.14, depth: 58 }, new Vector3(-7.95, 6.35, 27), darkSteel, false);
    this.visualFactory.box('tray', { width: 1.8, height: 0.08, depth: 58 }, new Vector3(7.4, 6.7, 27), panel, false);

    for (const z of [-1, 8, 18, 30, 41, 52]) {
      this.visualFactory.box(`col-l-${z}`, { width: 0.55, height: 7.4, depth: 0.55 }, new Vector3(-9.45, 3.5, z), darkSteel, true);
      this.visualFactory.box(`col-r-${z}`, { width: 0.55, height: 7.4, depth: 0.55 }, new Vector3(9.45, 3.5, z), darkSteel, true);
      this.visualFactory.box(`sconce-l-${z}`, { width: 0.12, height: 0.35, depth: 0.18 }, new Vector3(-9.22, 3.1, z), z > 40 ? amber : cyan, false);
      this.visualFactory.box(`sconce-r-${z}`, { width: 0.12, height: 0.35, depth: 0.18 }, new Vector3(9.22, 3.1, z), z > 40 ? amber : cyan, false);
    }

    this.visualFactory.box('divider-left', { width: 7.4, height: 7, depth: 0.7 }, new Vector3(-6.3, 3.25, 21), darkSteel, true);
    this.visualFactory.box('divider-right', { width: 7.4, height: 7, depth: 0.7 }, new Vector3(6.3, 3.25, 21), darkSteel, true);
    this.visualFactory.box('divider-top', { width: 5.2, height: 1.9, depth: 0.7 }, new Vector3(0, 6.15, 21), steel, true);
    this.visualFactory.box('door-jamb-l', { width: 0.35, height: 5.4, depth: 0.85 }, new Vector3(-2.75, 2.7, 21), rust, true);
    this.visualFactory.box('door-jamb-r', { width: 0.35, height: 5.4, depth: 0.85 }, new Vector3(2.75, 2.7, 21), rust, true);
    this.visualFactory.box('threshold', { width: 5.1, height: 0.12, depth: 1.1 }, new Vector3(0, 0.06, 21), rust, false);
    this.visualFactory.box('hazard-a', { width: 5.1, height: 0.03, depth: 0.18 }, new Vector3(0, 0.14, 20.4), amber, false);
    this.visualFactory.box('hazard-b', { width: 5.1, height: 0.03, depth: 0.18 }, new Vector3(0, 0.14, 21.6), amber, false);

    for (const encounter of FACILITY_LAYOUT.encounters) {
      for (const [index, node] of encounter.coverNodes.entries()) {
        this.visualFactory.createCover(`cover-${encounter.id}-${index}`, node, index);
      }
    }

    this.visualFactory.placeFacilityProps(steel, darkSteel, rust, panel);
    this.gateMesh = this.visualFactory.buildBlastGate(darkSteel, steel, rust, amber);

    const gateLight = new PointLight('gate-light', new Vector3(0, 4.2, 49.5), scene);
    gateLight.diffuse = new Color3(0.95, 0.42, 0.08);
    gateLight.intensity = 1.15;
    gateLight.range = 20;

    const encounter = section === 'FACILITY_ONE' ? FACILITY_LAYOUT.encounters[0] : FACILITY_LAYOUT.encounters[1];
    const humanStart = section === 'BOMB_GATE'
      ? new Vector3(3.2, 1.7, 43.5)
      : Vector3.FromArray([
          encounter.playerStart.x,
          encounter.playerStart.y,
          encounter.playerStart.z,
        ]);
    this.camera.position.copyFrom(humanStart);
    this.camera.setTarget(new Vector3(0, 1.7, humanStart.z + 8));
    this.characterPositions[this.representedHuman] = humanStart.clone();
    const partnerId: CharacterId = this.representedHuman === 'OWEN' ? 'CODY' : 'OWEN';
    const partnerStart = section === 'BOMB_GATE'
      ? new Vector3(-2.5, 0, 44)
      : new Vector3(encounter.partnerStart.x, 0, encounter.partnerStart.z);
    this.characterPositions[partnerId] = partnerStart.add(new Vector3(0, 1.7, 0));
    this.partnerMesh = this.visualFactory.createCharacter(partnerId, partnerStart);

    const spawnPoints =
      section === 'FACILITY_ONE'
        ? FACILITY_LAYOUT.encounters[0].enemySpawns
        : section === 'FACILITY_TWO'
          ? FACILITY_LAYOUT.encounters[1].enemySpawns
          : [
              { x: -6.2, y: 0, z: 39 },
              { x: 5.5, y: 0, z: 42 },
              { x: 2.2, y: 0, z: 46 },
            ];
    this.enemies = spawnPoints.map((point, index) => this.visualFactory.createEnemy(`guard-${section}-${index + 1}`, point));
  }

  private buildChase(): void {
    const asphalt = this.visualFactory.material('asphalt', new Color3(0.04, 0.045, 0.048), 1);
    const line = this.visualFactory.material('road-line', new Color3(0.55, 0.48, 0.22), 0.7, new Color3(0.18, 0.12, 0.03));
    const barrier = this.visualFactory.material('barrier', new Color3(0.16, 0.18, 0.17), 0.86);
    const ground = this.visualFactory.material('snow-ground', new Color3(0.12, 0.16, 0.17), 1);
    const snow = this.visualFactory.material('snow-bank', new Color3(0.2, 0.24, 0.25), 1);
    const nightSteel = this.visualFactory.material('night-steel', new Color3(0.04, 0.055, 0.06), 0.9);
    const lamp = this.visualFactory.material('street-lamp', new Color3(0.45, 0.4, 0.22), 0.4, new Color3(0.55, 0.42, 0.12));
    const carMaterial = this.visualFactory.material('getaway', new Color3(0.04, 0.18, 0.19), 0.42);
    const glass = this.visualFactory.material('cabin-glass', new Color3(0.05, 0.08, 0.1), 0.35, new Color3(0.02, 0.08, 0.1));
    const head = this.visualFactory.material('headlamp', new Color3(0.7, 0.78, 0.7), 0.25, new Color3(0.7, 0.78, 0.55));

    this.scene.clearColor = new Color4(0.008, 0.016, 0.028, 1);
    this.scene.fogDensity = 0.012;
    this.scene.fogColor = new Color3(0.02, 0.045, 0.07);
    this.scene.ambientColor = new Color3(0.02, 0.04, 0.055);
    const moon = new DirectionalLight('moon', new Vector3(0.35, -0.7, 0.2), this.scene);
    moon.intensity = 0.55;
    moon.diffuse = new Color3(0.35, 0.52, 0.72);

    this.visualFactory.box('exterior-ground', { width: 180, height: 0.3, depth: 360 }, new Vector3(0, -0.35, 150), ground, true);
    this.visualFactory.box('exit-mouth', { width: 22, height: 9, depth: 6 }, new Vector3(0, 4.2, -8), nightSteel, true);
    this.visualFactory.box('exit-lip', { width: 16, height: 0.4, depth: 1.2 }, new Vector3(0, 0.2, -4.4), nightSteel, false);

    for (let progress = 0; progress <= CHASE_ROUTE.length; progress += 4) {
      const z = progress * 3;
      const x = this.routeX(progress);
      this.visualFactory.box(`road-${progress}`, { width: 15.4, height: 0.22, depth: 12.4 }, new Vector3(x, -0.08, z), asphalt, true);
      this.visualFactory.box(`line-${progress}`, { width: 0.16, height: 0.04, depth: 3.4 }, new Vector3(x, 0.06, z), line, false);
      this.visualFactory.box(`edge-l-${progress}`, { width: 0.18, height: 0.05, depth: 12.2 }, new Vector3(x - 6.6, 0.05, z), line, false);
      this.visualFactory.box(`edge-r-${progress}`, { width: 0.18, height: 0.05, depth: 12.2 }, new Vector3(x + 6.6, 0.05, z), line, false);
      this.visualFactory.box(`barrier-l-${progress}`, { width: 0.42, height: 1.05, depth: 12.2 }, new Vector3(x - 8.1, 0.5, z), barrier, true);
      this.visualFactory.box(`barrier-r-${progress}`, { width: 0.42, height: 1.05, depth: 12.2 }, new Vector3(x + 8.1, 0.5, z), barrier, true);
      this.visualFactory.box(`snow-l-${progress}`, { width: 4.2, height: 0.7, depth: 12 }, new Vector3(x - 11.2, 0.1, z), snow, false);
      this.visualFactory.box(`snow-r-${progress}`, { width: 4.2, height: 0.7, depth: 12 }, new Vector3(x + 11.2, 0.1, z), snow, false);
    }

    for (let progress = 0; progress <= CHASE_ROUTE.length; progress += 12) {
      const z = progress * 3;
      const x = this.routeX(progress);
      for (const side of [-1, 1]) {
        const pole = MeshBuilder.CreateCylinder(`pole-${progress}-${side}`, { diameter: 0.16, height: 5.4, tessellation: 8 }, this.scene);
        pole.position = new Vector3(x + side * 8.9, 2.5, z);
        pole.material = nightSteel;
        pole.isPickable = false;
        const lantern = this.visualFactory.box(`lantern-${progress}-${side}`, { width: 0.7, height: 0.18, depth: 0.35 }, new Vector3(x + side * 8.4, 5.05, z), lamp, false);
        lantern.isPickable = false;
      }
      if (progress % 24 === 0) {
        const street = new PointLight(`street-${progress}`, new Vector3(x, 4.8, z), this.scene);
        street.diffuse = new Color3(0.72, 0.62, 0.32);
        street.intensity = 0.85;
        street.range = 26;
      }
    }

    for (const turn of CHASE_ROUTE.turns) {
      const z = turn.progress * 3;
      const x = this.routeX(turn.progress);
      const dir = turn.safeAction === 'RIGHT' ? 1 : -1;
      this.visualFactory.box(`turn-mark-${turn.id}`, { width: 1.8, height: 0.08, depth: 0.5 }, new Vector3(x + dir * 2.4, 0.08, z), lamp, false);
      this.visualFactory.box(`gantry-${turn.id}`, { width: 16.4, height: 0.28, depth: 0.35 }, new Vector3(x, 4.4, z), nightSteel, false);
    }

    this.carMesh = this.visualFactory.box('getaway-car', { width: 2.55, height: 0.95, depth: 5.1 }, new Vector3(0, 0.78, 2), carMaterial, false);
    this.carMesh.metadata = { kind: 'getaway' };
    const cabin = this.visualFactory.box('getaway-cabin', { width: 2.2, height: 0.78, depth: 2.15 }, new Vector3(0, 0.72, 0.15), glass, false);
    cabin.parent = this.carMesh;
    const hood = this.visualFactory.box('getaway-hood', { width: 2.4, height: 0.22, depth: 1.5 }, new Vector3(0, 0.28, 1.7), carMaterial, false);
    hood.parent = this.carMesh;
    const bumper = this.visualFactory.box('getaway-bumper', { width: 2.6, height: 0.28, depth: 0.28 }, new Vector3(0, -0.18, 2.5), nightSteel, false);
    bumper.parent = this.carMesh;
    for (const x of [-0.85, 0.85]) {
      const lampMesh = this.visualFactory.box(`head-${x}`, { width: 0.38, height: 0.18, depth: 0.12 }, new Vector3(x, 0.05, 2.52), head, false);
      lampMesh.parent = this.carMesh;
    }
    for (const x of [-1.28, 1.28]) {
      for (const z of [-1.7, 1.55]) {
        const wheel = MeshBuilder.CreateCylinder(`wheel-${x}-${z}`, { diameter: 0.74, height: 0.32, tessellation: 16 }, this.scene);
        wheel.rotation.z = Math.PI / 2;
        wheel.position = new Vector3(x, -0.28, z);
        wheel.parent = this.carMesh;
        wheel.material = barrier;
        wheel.isPickable = false;
      }
    }
    const headlight = new PointLight('getaway-headlight', new Vector3(0, 0.2, 3.2), this.scene);
    headlight.parent = this.carMesh;
    headlight.diffuse = new Color3(0.85, 0.9, 0.78);
    headlight.intensity = 1.35;
    headlight.range = 32;

    this.pursuers = CHASE_ROUTE.pursuerStarts.map((start, index) =>
      this.visualFactory.createPursuer(`pursuer-${index + 1}`, {
        x: start.lane * 3.2,
        y: 0,
        z: 2 - start.distanceBehind,
      }),
    );
    this.enemies = this.pursuers;
    this.options.services.coordinator.publish({
      type: 'CHASE_TARGETS_VISIBLE',
      summary: `Visible targets: ${this.pursuers.map((pursuer) => pursuer.id).join(', ')}.`,
    });
    this.chaseProgress = 0;
    this.chaseLane = 0;
    this.chaseCompleted = false;
    this.turnState.clear();
    this.configureChaseCamera();
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameAt) / 1_000, 0.05);
    this.lastFrameAt = now;
    this.options.services.store.tick();
    const snapshot = this.options.services.store.getSnapshot();
    this.lastInputFrame = this.input.poll();

    if (
      shouldAdvanceMissionSimulation({
        phase: snapshot.phase,
        paused: snapshot.paused,
        switching: snapshot.switching.state,
      })
    ) {
      this.updateHumanInput(this.lastInputFrame, dt, now);
      this.updateCameraFeel(dt, snapshot.section);
      if (snapshot.section && FACILITY_SECTIONS.has(snapshot.section)) this.frameFacility(now, dt);
      if (snapshot.section === 'CHASE') this.frameChase(now, dt);
    }
    this.emitStatus(false);
    this.scene.render();
  }

  private frameFacility(now: number, dt: number): void {
    const snapshot = this.options.services.store.getSnapshot();
    this.characterPositions[snapshot.humanCharacter] = this.camera.position.clone();
    this.movePartner(dt);
    this.partnerCombat(now);
    this.enemyCombat(now);

    const alive = this.enemies.filter((enemy) => enemy.alive).length;
    if (
      alive === 0 &&
      (snapshot.section === 'FACILITY_ONE' || snapshot.section === 'FACILITY_TWO')
    ) {
      this.encounterAdvanceAt ??= now + 900;
      if (now >= this.encounterAdvanceAt) {
        this.encounterAdvanceAt = Number.POSITIVE_INFINITY;
        this.options.services.director.completeEncounter();
      }
    }

    if (snapshot.section === 'BOMB_GATE') {
      if (snapshot.bomb.state === 'PLANTING') {
        this.plantingStartedAt ??= now;
        this.movePartnerToward(FACILITY_LAYOUT.gate.plantPoint, dt, 3.4);
        if (now - this.plantingStartedAt >= 4_200) {
          this.plantingStartedAt = Number.POSITIVE_INFINITY;
          this.options.services.director.finishChargePlant();
        }
      }
      if (snapshot.bomb.state === 'ARMED' && this.options.services.director.isPartnerClearOfCharge()) {
        this.movePartnerToward(FACILITY_LAYOUT.gate.safePoint, dt, 4.6);
      }
      if (snapshot.bomb.state === 'DETONATED') {
        if (this.gateMesh) this.gateMesh.position.y = Math.min(10, this.gateMesh.position.y + dt * 8);
        this.gateOpenedAt ??= now;
        if (now - this.gateOpenedAt > 2_400) {
          this.gateOpenedAt = Number.POSITIVE_INFINITY;
          this.options.services.director.startChase();
        }
      }
    }
  }

  private frameChase(now: number, dt: number): void {
    const snapshot = this.options.services.store.getSnapshot();
    if (!this.carMesh || this.chaseCompleted) return;
    const agentAction = this.options.services.director.consumeSteeringAction();
    if (agentAction) this.applySteeringAction(agentAction);
    const holdForAgent = shouldHoldForAgentTurn(
      snapshot.humanCharacter,
      snapshot.requiredDecision?.kind ?? null,
    );
    if (!holdForAgent) {
      this.chaseProgress = Math.min(CHASE_ROUTE.length, this.chaseProgress + dt * 3.8);
    }
    const roadX = this.routeX(this.chaseProgress);

    if (snapshot.humanCharacter === 'OWEN') {
      if (this.pressed.has('KeyA')) this.chaseLane = Math.max(CHASE_ROUTE.laneMin, this.chaseLane - dt * 1.6);
      if (this.pressed.has('KeyD')) this.chaseLane = Math.min(CHASE_ROUTE.laneMax, this.chaseLane + dt * 1.6);
    }
    const desiredX = roadX + this.chaseLane * 3.25;
    this.carMesh.position.x += (desiredX - this.carMesh.position.x) * Math.min(1, dt * 5);
    this.carMesh.position.z = this.chaseProgress * 3;
    this.carMesh.rotation.y = (this.routeX(this.chaseProgress + 1) - roadX) * 0.045;
    this.updateChaseCamera();
    this.updatePursuers(now, dt);
    this.handleChaseTurns();

    if (now - this.lastEnemyAttackAt > 1_550 && this.pursuers.some((enemy) => enemy.alive)) {
      this.lastEnemyAttackAt = now;
      this.audio.play('IMPACT');
      if (this.attackSequence++ % 4 === 3) {
        const target: CharacterId = this.attackSequence % 2 === 0 ? 'OWEN' : 'CODY';
        this.options.services.store.damageCharacter(target, 4, 'ENEMY_FIRE');
      } else {
        this.options.services.store.damageVehicle(5, 'PURSUER_FIRE');
      }
    }
    if (snapshot.humanCharacter === 'OWEN' && now - this.lastPartnerShotAt > 1_250) {
      this.lastPartnerShotAt = now;
      this.audio.play('SHOT');
      this.damagePrioritizedEnemy(35);
    }
    if (now - this.lastEngineCueAt > 720) {
      this.lastEngineCueAt = now;
      this.audio.play('ENGINE');
    }

    if (this.chaseProgress >= CHASE_ROUTE.length) {
      this.chaseCompleted = true;
      this.options.services.store.completeMission();
    }
  }

  private syncDomainState(): void {
    const snapshot = this.options.services.store.getSnapshot();
    const newest = snapshot.history.at(-1);
    const isNewEvent = newest !== undefined && newest.id !== this.lastHistoryEventId;
    if (isNewEvent) {
      this.lastHistoryEventId = newest.id;
      this.playHistoryCue(newest.type);
      if (newest.type === 'CHECKPOINT_RESTORED') {
        this.buildForSnapshot();
        return;
      }
      if (newest.type === 'SWITCH_COMPLETED') this.recordTutorialEvent('CHARACTER_SWITCHED');
    }
    if (snapshot.section !== this.currentSection) {
      this.buildForSnapshot();
      return;
    }
    if (snapshot.humanCharacter !== this.representedHuman) {
      this.swapCharacterView(snapshot.humanCharacter);
    }
  }

  private swapCharacterView(nextHuman: CharacterId): void {
    const previous = this.representedHuman;
    this.characterPositions[previous] = this.camera.position.clone();
    this.representedHuman = nextHuman;
    const target = this.characterPositions[nextHuman] ?? this.camera.position.clone();
    this.camera.position.copyFrom(target);
    this.partnerMesh?.dispose();
    this.partnerMesh = this.visualFactory.createCharacter(previous, this.characterPositions[previous].subtract(new Vector3(0, 1.7, 0)));
    if (this.currentSection === 'CHASE') this.configureChaseCamera();
  }

  private movePartner(dt: number): void {
    if (!this.partnerMesh || !this.currentSection || this.currentSection === 'CHASE') return;
    const snapshot = this.options.services.store.getSnapshot();
    const human = this.camera.position;
    const encounter = snapshot.section === 'FACILITY_ONE' ? FACILITY_LAYOUT.encounters[0] : FACILITY_LAYOUT.encounters[1];
    const aliveEnemy = this.enemies.find((enemy) => enemy.alive);
    let target = this.partnerMesh.position.clone();
    switch (snapshot.partnerTactic) {
      case 'ADVANCE':
        target = aliveEnemy ? aliveEnemy.mesh.position.add(new Vector3(0, 0, -5)) : new Vector3(0, 0, encounter.bounds.maxZ - 2);
        break;
      case 'COVER':
        target = new Vector3(this.partnerMesh.position.x, 0, Math.max(this.partnerMesh.position.z, human.z - 1));
        break;
      case 'FLANK':
        target = new Vector3(human.x > 0 ? -6 : 6, 0, Math.min(encounter.bounds.maxZ - 2, human.z + 5));
        break;
      case 'RETREAT':
        target = new Vector3(human.x > 0 ? -4 : 4, 0, Math.max(encounter.bounds.minZ + 2, human.z - 5));
        break;
      case 'PROTECT':
        target = new Vector3(human.x + (human.x > 0 ? -2 : 2), 0, human.z + 1);
        break;
      case 'HOLD':
        return;
    }
    this.movePartnerToward(target, dt, 2.8);
  }

  private movePartnerToward(point: WorldPoint, dt: number, speed: number): void {
    if (!this.partnerMesh) return;
    const target = new Vector3(point.x, 0.95, point.z);
    const delta = target.subtract(this.partnerMesh.position);
    delta.y = 0;
    if (delta.lengthSquared() < 0.04) return;
    const direction = delta.normalize();
    this.partnerMesh.position.addInPlace(direction.scale(Math.min(delta.length(), speed * dt)));
    this.partnerMesh.rotation.y = Math.atan2(direction.x, direction.z);
    const partnerId: CharacterId = this.representedHuman === 'OWEN' ? 'CODY' : 'OWEN';
    this.characterPositions[partnerId] = this.partnerMesh.position.add(new Vector3(0, 0.75, 0));
  }

  private partnerCombat(now: number): void {
    const snapshot = this.options.services.store.getSnapshot();
    if (!this.partnerMesh || now - this.lastPartnerShotAt < 1_100) return;
    const enemy = this.closestEnemyTo(this.partnerMesh.position);
    if (!enemy) return;
    if (snapshot.partnerTactic === 'HOLD' && Vector3.Distance(enemy.mesh.position, this.partnerMesh.position) > 15) return;
    this.lastPartnerShotAt = now;
    this.audio.play('SHOT');
    this.damageEnemy(enemy, snapshot.partnerTactic === 'PROTECT' ? 60 : 48);
  }

  private enemyCombat(now: number): void {
    if (this.tutorial.getSnapshot().active) return;
    if (now - this.lastEnemyAttackAt < 1_700) return;
    const alive = this.enemies.filter((enemy) => enemy.alive);
    if (alive.length === 0) return;
    this.lastEnemyAttackAt = now;
    const snapshot = this.options.services.store.getSnapshot();
    const partnerId: CharacterId = snapshot.humanCharacter === 'OWEN' ? 'CODY' : 'OWEN';
    const target = snapshot.partnerTactic === 'PROTECT' && this.attackSequence++ % 3 !== 0
      ? partnerId
      : snapshot.humanCharacter;
    this.audio.play('IMPACT');
    this.options.services.store.damageCharacter(target, 4 + (this.attackSequence % 3), 'ENEMY_FIRE');
  }

  private handlePointerDown(event: PointerEvent): void {
    void this.audio.unlock().then((unlocked) => {
      if (
        unlocked &&
        !this.alarmPlayed &&
        this.currentSection !== null &&
        FACILITY_SECTIONS.has(this.currentSection)
      ) {
        this.alarmPlayed = true;
        this.audio.play('ALARM');
      }
    });
    if (event.button === 2) {
      this.pressed.add('MouseRight');
      this.pointerLock.setDragActive(true);
    }
    if (this.pointerLock.getSnapshot().state !== 'LOCKED') {
      void this.pointerLock.request();
      return;
    }
    if (event.button === 0) this.fireHumanWeapon(performance.now());
  }

  private handlePointerUp(event: PointerEvent): void {
    if (event.button === 2) {
      this.pressed.delete('MouseRight');
      this.pointerLock.setDragActive(false);
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    const callouts: Record<string, string> = {
      Digit1: 'COVER ME',
      Digit2: 'HOLD',
      Digit3: 'MOVE',
      Digit4: 'FOCUS TARGET',
    };
    const callout = callouts[event.code];
    if (callout) {
      this.options.services.coordinator.publish({ type: 'HUMAN_CALLOUT', summary: callout });
      this.recordTutorialEvent('CALLOUT_SENT');
    }
  }

  private handleChaseTurns(): void {
    const snapshot = this.options.services.store.getSnapshot();
    for (const turn of CHASE_ROUTE.turns) {
      const id = turn.id as 1 | 2;
      let state = this.turnState.get(id);
      if (!state && this.chaseProgress >= turn.progress - 1.5) {
        const controller = this.options.services.director.requestChaseTurn(id);
        state = { evaluated: false, humanAction: 'HOLD' };
        this.turnState.set(id, state);
        if (controller.ok && controller.controller === 'HUMAN') {
          state.humanAction = this.pressed.has('KeyA') ? 'LEFT' : this.pressed.has('KeyD') ? 'RIGHT' : 'HOLD';
        }
      }
      if (!state || state.evaluated || this.chaseProgress < turn.progress + 2) continue;
      const action = snapshot.humanCharacter === 'OWEN'
        ? this.pressed.has('KeyA')
          ? 'LEFT'
          : this.pressed.has('KeyD')
            ? 'RIGHT'
            : state.humanAction
        : this.chaseLane < -0.25
          ? 'LEFT'
          : this.chaseLane > 0.25
            ? 'RIGHT'
            : 'HOLD';
      state.evaluated = true;
      if (action !== turn.safeAction) {
        this.options.services.store.damageVehicle(18, 'COLLISION');
        if (this.options.services.store.getSnapshot().phase === 'MISSION') {
          this.options.services.store.recordCriticalIncident(`WRONG_TURN_${turn.id}`);
        }
      }
    }
  }

  private applySteeringAction(action: 'LEFT' | 'RIGHT' | 'HOLD'): void {
    if (action === 'LEFT') this.chaseLane = -1;
    if (action === 'RIGHT') this.chaseLane = 1;
    if (action === 'HOLD') this.chaseLane = 0;
  }

  private updatePursuers(now: number, dt: number): void {
    if (!this.carMesh) return;
    for (const [index, pursuer] of this.pursuers.entries()) {
      if (!pursuer.alive) continue;
      const target = new Vector3(
        this.carMesh.position.x + (index - 1) * 2.8,
        0.72,
        this.carMesh.position.z - 12 - index * 6,
      );
      pursuer.mesh.position = Vector3.Lerp(pursuer.mesh.position, target, Math.min(1, dt * 1.4));
      pursuer.mesh.rotation.y = this.carMesh.rotation.y;
    }
  }

  private updateCameraFeel(dt: number, section: MissionSection | null): void {
    const aiming = this.lastInputFrame.aim > 0.35 || this.pressed.has('MouseRight');
    const desiredFov = aiming ? 0.78 : 1.05;
    this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 12);
    if (!section || !FACILITY_SECTIONS.has(section)) return;
  }

  private updateHumanInput(input: InputFrame, dt: number, now: number): void {
    const snapshot = this.options.services.store.getSnapshot();
    const pointerActive =
      this.pointerLock.getSnapshot().state === 'LOCKED' || this.pressed.has('MouseRight');
    if (input.device !== 'KEYBOARD_MOUSE' || pointerActive) {
      const lookScale = input.device === 'KEYBOARD_MOUSE' ? 0.00165 : dt * 2.35;
      let yaw = input.look.x * lookScale;
      let pitch = input.look.y * lookScale;
      if (input.device !== 'KEYBOARD_MOUSE') {
        const assist = computeAimAssistCorrection(this.findAimAssistTarget(input.aim > 0.35), {
          inputDevice: input.device,
          aiming: input.aim > 0.35,
          deltaSeconds: dt,
        });
        yaw = yaw * assist.slowdown + assist.yaw;
        pitch = pitch * assist.slowdown + assist.pitch;
      }
      this.camera.rotation.y += yaw;
      this.camera.rotation.x = Math.min(Math.max(this.camera.rotation.x - pitch, -1.35), 1.35);
    }

    if (snapshot.section && FACILITY_SECTIONS.has(snapshot.section)) {
      const motor = this.playerMotor.update({ move: input.move, sprinting: input.sprinting }, dt);
      const cameraYaw = this.camera.rotation.y;
      const right = new Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      const forward = new Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      this.camera.cameraDirection.addInPlace(
        right.scale(motor.delta.x).add(forward.scale(motor.delta.y)),
      );
      this.camera.position.y += motor.camera.bobY - this.lastCameraBob;
      this.lastCameraBob = motor.camera.bobY;
      this.camera.rotation.z = motor.camera.lean;
    }

    if (input.reloadPressed) this.options.services.store.reloadWeapon(snapshot.humanCharacter);
    if (input.switchPressed) this.options.services.store.beginSwitch();
    if (
      input.interactPressed &&
      snapshot.section === 'BOMB_GATE' &&
      snapshot.bomb.state === 'ARMED'
    ) {
      this.options.services.director.detonateCharge();
    }
    if (input.calloutPressed && input.device !== 'KEYBOARD_MOUSE') {
      this.options.services.coordinator.publish({ type: 'HUMAN_CALLOUT', summary: 'COVER ME' });
      this.recordTutorialEvent('CALLOUT_SENT');
    }
    this.tutorial.updateSkipHeld(input.skipTrainingHeld, dt);
    if (input.skipTrainingHeld) this.persistTutorialIfFinished();
    if (Math.hypot(input.move.x, input.move.y) > 0.3) this.recordTutorialEvent('MOVED');
    if (input.aim > 0.35 || this.pressed.has('MouseRight')) this.recordTutorialEvent('AIMED');
    if (input.fire > 0.5 && input.device !== 'KEYBOARD_MOUSE') this.fireHumanWeapon(now);
  }

  private findAimAssistTarget(aiming: boolean): AimAssistCandidate | null {
    const forward = this.camera.getForwardRay(1).direction.normalize();
    const candidates = this.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy): AimAssistCandidate => {
        const offset = enemy.mesh.position
          .add(new Vector3(0, 1.1, 0))
          .subtract(this.camera.position);
        const distance = offset.length();
        const direction = distance > 0 ? offset.scale(1 / distance) : forward;
        const angularError = Math.acos(
          Math.min(Math.max(Vector3.Dot(forward, direction), -1), 1),
        );
        const hit = this.scene.pickWithRay(
          new Ray(this.camera.position, direction, distance + 0.5),
          (mesh) => mesh.isPickable && mesh.isEnabled(),
        );
        const visible = this.resolveEnemy(hit?.pickedMesh ?? null)?.id === enemy.id;
        const targetYaw = Math.atan2(direction.x, direction.z);
        const targetPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
        const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
        return {
          id: enemy.id,
          alive: enemy.alive,
          visible,
          angularError,
          distance,
          yawError: normalizeAngle(targetYaw - this.camera.rotation.y),
          pitchError: normalizeAngle(targetPitch + this.camera.rotation.x),
        };
      });
    return chooseAimAssistTarget(candidates, {
      coneRadians: aiming ? 0.11 : 0.075,
      maxDistance: 70,
    });
  }

  private fireHumanWeapon(now: number): void {
    if (now - this.lastHumanShotAt < 135) return;
    const snapshot = this.options.services.store.getSnapshot();
    if (snapshot.paused || snapshot.phase !== 'MISSION') return;
    if (snapshot.section === 'CHASE' && snapshot.humanCharacter !== 'CODY') return;
    const fired = this.options.services.store.fireWeapon(snapshot.humanCharacter);
    if (!fired.ok) return;
    this.lastHumanShotAt = now;
    this.audio.play('SHOT');
    const ray = this.camera.getForwardRay(120);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) => mesh.metadata?.kind === 'enemy' && mesh.isEnabled(),
    );
    const enemy = this.resolveEnemy(hit?.pickedMesh ?? null);
    if (enemy) {
      this.damageEnemy(enemy, snapshot.section === 'CHASE' ? 60 : 55);
      this.recordTutorialEvent('HIT_ENEMY');
    }
    this.flashMuzzle();
  }

  private recordTutorialEvent(type: 'MOVED' | 'AIMED' | 'HIT_ENEMY' | 'CALLOUT_SENT' | 'CHARACTER_SWITCHED'): void {
    this.tutorial.record({ type });
    this.persistTutorialIfFinished();
  }

  private persistTutorialIfFinished(): void {
    if (!this.tutorial.getSnapshot().active) {
      window.localStorage.setItem('hs-heist:tutorial-complete', '1');
    }
  }

  private configureChaseCamera(): void {
    this.camera.applyGravity = false;
    this.camera.checkCollisions = false;
    this.camera.detachControl();
    this.updateChaseCamera();
  }

  private updateChaseCamera(): void {
    if (!this.carMesh) return;
    const human = this.options.services.store.getSnapshot().humanCharacter;
    if (human === 'OWEN') {
      this.camera.position.copyFrom(this.carMesh.position.add(new Vector3(0, 2.15, 0.8)));
      this.camera.setTarget(this.carMesh.position.add(new Vector3(0, 1.1, 24)));
    } else {
      this.camera.position.copyFrom(this.carMesh.position.add(new Vector3(0, 2.3, -1.2)));
      this.camera.setTarget(this.carMesh.position.add(new Vector3(0, 1.15, -24)));
    }
  }

  private resolveEnemy(mesh: { metadata?: { kind?: string; id?: string }; parent: unknown } | null): RuntimeEnemy | null {
    let current = mesh;
    while (current) {
      const id = current.metadata?.id;
      if (current.metadata?.kind === 'enemy' && typeof id === 'string') {
        return [...this.enemies, ...this.pursuers].find((enemy) => enemy.id === id || enemy.mesh === current) ?? null;
      }
      current = current.parent as typeof current;
    }
    return null;
  }

  private damagePrioritizedEnemy(amount: number): void {
    const origin = this.partnerMesh?.position ?? this.carMesh?.position ?? Vector3.Zero();
    const candidates = this.enemies.map((enemy) => ({
      ...enemy,
      distanceSquared: Vector3.DistanceSquared(origin, enemy.mesh.position),
    }));
    const selected = choosePrioritizedTarget(
      candidates,
      this.options.services.coordinator.getTargetPriority(),
    );
    const enemy = selected ? this.enemies.find((candidate) => candidate.id === selected.id) ?? null : null;
    if (enemy) this.damageEnemy(enemy, amount);
  }

  private closestEnemyTo(position: Vector3): RuntimeEnemy | null {
    let closest: RuntimeEnemy | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const candidateDistance = Vector3.DistanceSquared(position, enemy.mesh.position);
      if (candidateDistance < distance) {
        closest = enemy;
        distance = candidateDistance;
      }
    }
    return closest;
  }

  private damageEnemy(enemy: RuntimeEnemy, amount: number): void {
    if (!enemy.alive) return;
    enemy.health = Math.max(0, enemy.health - amount);
    this.audio.play('IMPACT');
    if (!this.prefersReducedMotion) {
      enemy.mesh.scaling.y = 0.9;
      window.setTimeout(() => {
        if (!enemy.mesh.isDisposed()) enemy.mesh.scaling.y = 1;
      }, 70);
    }
    if (enemy.health > 0) return;
    enemy.alive = false;
    enemy.mesh.setEnabled(false);
    this.options.services.coordinator.publish({
      type: 'THREAT_NEUTRALIZED',
      summary: `${enemy.id} was eliminated.`,
    });
    this.emitStatus(true);
  }

  private flashMuzzle(): void {
    const light = new PointLight(`muzzle-${performance.now()}`, this.camera.position.add(this.camera.getForwardRay(1).direction), this.scene);
    light.diffuse = new Color3(1, 0.56, 0.18);
    light.intensity = this.prefersReducedMotion ? 3 : 8;
    light.range = this.prefersReducedMotion ? 4 : 7;
    window.setTimeout(() => light.dispose(), this.prefersReducedMotion ? 20 : 55);
  }

  private playHistoryCue(type: string): void {
    if (type === 'SWITCH_STARTED') this.audio.play('SWITCH');
    if (type === 'CHARGE_DETONATED') this.audio.play('EXPLOSION');
  }

  private routeX(progress: number): number {
    if (progress < 32) return 0;
    if (progress < 45) return ((progress - 32) / 13) * 6;
    if (progress < 68) return 6;
    if (progress < 82) return 6 - ((progress - 68) / 14) * 10;
    return -4;
  }

  private emitStatus(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastStatusAt < 120) return;
    this.lastStatusAt = now;
    const snapshot = this.options.services.store.getSnapshot();
    let prompt: string | null = null;
    const pointerLock = this.pointerLock.getSnapshot();
    if (pointerLock.state !== 'LOCKED' && this.lastInputFrame.device === 'KEYBOARD_MOUSE') {
      prompt = pointerLock.state === 'DENIED' || pointerLock.state === 'UNAVAILABLE'
        ? 'MOUSE CAPTURE UNAVAILABLE — USE CONTROLLER OR HOLD RIGHT-CLICK TO LOOK'
        : 'CLICK TO TAKE CONTROL';
    }
    const tutorial = this.tutorial.getSnapshot();
    if (tutorial.active && (pointerLock.state === 'LOCKED' || this.lastInputFrame.device !== 'KEYBOARD_MOUSE')) {
      const trainingPrompts: Record<Exclude<TutorialSnapshot['step'], 'COMPLETE'>, string> = {
        MOVE: 'TRAINING — MOVE FROM COVER · HOLD T OR DPAD DOWN TO SKIP',
        AIM: 'TRAINING — AIM AT A HIGHLIGHTED GUARD',
        FIRE: 'TRAINING — FIRE AND CONFIRM A HIT',
        CALLOUT: 'TRAINING — SEND A PARTNER CALLOUT',
        SWITCH: 'TRAINING — SWITCH CHARACTERS',
      };
      if (tutorial.step !== 'COMPLETE') prompt = trainingPrompts[tutorial.step];
    }
    if (snapshot.bomb.state === 'ARMED') {
      prompt = this.options.services.director.isPartnerClearOfCharge()
        ? 'CODY CLEAR — PRESS E TO DETONATE'
        : 'CHARGE ARMED — WAIT FOR CODY OR RISK THE BLAST';
    }
    if (snapshot.requiredDecision) prompt = `PARTNER DECISION: ${snapshot.requiredDecision.kind}`;
    this.options.onStatus({
      enemiesRemaining: this.enemies.filter((enemy) => enemy.alive).length,
      chaseProgress: this.chaseProgress,
      prompt,
      pointerLocked: pointerLock.state === 'LOCKED',
      pointerLock,
      inputDevice: this.lastInputFrame.device,
      tutorial,
    });
  }
}
