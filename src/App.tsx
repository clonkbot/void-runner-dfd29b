import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

type GameMode = 'flight' | 'walking';

interface ShipState {
  speed: number;
  pitch: number;
  roll: number;
  yaw: number;
  throttle: number;
  shields: number;
  hull: number;
  fuel: number;
  position: THREE.Vector3;
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<GameMode>('flight');
  const [isLocked, setIsLocked] = useState(false);
  const [shipState, setShipState] = useState<ShipState>({
    speed: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
    shields: 100,
    hull: 100,
    fuel: 87.3,
    position: new THREE.Vector3(0, 0, 0),
  });
  const [showInstructions, setShowInstructions] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const shipGroupRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const velocityRef = useRef(new THREE.Vector3());
  const shipVelocityRef = useRef(new THREE.Vector3());
  const frameRef = useRef<number>(0);

  const createStarfield = useCallback(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < 15000; i++) {
      const x = (Math.random() - 0.5) * 4000;
      const y = (Math.random() - 0.5) * 4000;
      const z = (Math.random() - 0.5) * 4000;
      vertices.push(x, y, z);

      const brightness = 0.5 + Math.random() * 0.5;
      const tint = Math.random();
      if (tint > 0.95) {
        colors.push(1, 0.8, 0.6);
      } else if (tint > 0.9) {
        colors.push(0.6, 0.8, 1);
      } else {
        colors.push(brightness, brightness, brightness);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    return new THREE.Points(geometry, material);
  }, []);

  const createCockpit = useCallback(() => {
    const group = new THREE.Group();

    // Floor
    const floorGeo = new THREE.BoxGeometry(12, 0.3, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.8,
      roughness: 0.4,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -2;
    group.add(floor);

    // Floor grid lines
    const gridHelper = new THREE.GridHelper(12, 12, 0xff6600, 0x333333);
    gridHelper.position.y = -1.84;
    group.add(gridHelper);

    // Ceiling
    const ceilingGeo = new THREE.BoxGeometry(12, 0.3, 20);
    const ceiling = new THREE.Mesh(ceilingGeo, floorMat);
    ceiling.position.y = 4;
    group.add(ceiling);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.6,
      roughness: 0.5,
    });

    // Left wall
    const leftWallGeo = new THREE.BoxGeometry(0.3, 6, 20);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-6, 1, 0);
    group.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(leftWallGeo, wallMat);
    rightWall.position.set(6, 1, 0);
    group.add(rightWall);

    // Back wall
    const backWallGeo = new THREE.BoxGeometry(12, 6, 0.3);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 1, 10);
    group.add(backWall);

    // Cockpit console
    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Main console desk
    const consoleGeo = new THREE.BoxGeometry(8, 1, 3);
    const console = new THREE.Mesh(consoleGeo, consoleMat);
    console.position.set(0, -0.5, -7);
    group.add(console);

    // Angled console top
    const angleGeo = new THREE.BoxGeometry(8, 0.2, 2);
    const angleMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.95,
      roughness: 0.1,
      emissive: 0xff6600,
      emissiveIntensity: 0.05,
    });
    const angleConsole = new THREE.Mesh(angleGeo, angleMat);
    angleConsole.position.set(0, 0.1, -6.5);
    angleConsole.rotation.x = -0.3;
    group.add(angleConsole);

    // Pilot seat
    const seatBaseMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
    });
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), seatBaseMat);
    seatBase.position.set(0, -1.5, -4);
    group.add(seatBase);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.3), seatBaseMat);
    seatBack.position.set(0, -0.5, -3.3);
    seatBack.rotation.x = 0.1;
    group.add(seatBack);

    // Side consoles
    const sideConsoleMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0x00ffff,
      emissiveIntensity: 0.02,
    });

    const leftConsole = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), sideConsoleMat);
    leftConsole.position.set(-4.5, -0.5, -5);
    leftConsole.rotation.y = 0.2;
    group.add(leftConsole);

    const rightConsole = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), sideConsoleMat);
    rightConsole.position.set(4.5, -0.5, -5);
    rightConsole.rotation.y = -0.2;
    group.add(rightConsole);

    // Cockpit window frame (front opening)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.5), wallMat);
    frameTop.position.set(0, 2.5, -9.5);
    group.add(frameTop);

    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), wallMat);
    frameLeft.position.set(-5, 0, -9.5);
    group.add(frameLeft);

    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), wallMat);
    frameRight.position.set(5, 0, -9.5);
    group.add(frameRight);

    // Ambient lights
    const ambientPanel1 = new THREE.PointLight(0xff6600, 0.5, 8);
    ambientPanel1.position.set(-4, 0, -6);
    group.add(ambientPanel1);

    const ambientPanel2 = new THREE.PointLight(0x00ffff, 0.3, 8);
    ambientPanel2.position.set(4, 0, -6);
    group.add(ambientPanel2);

    // Back area lights
    const backLight = new THREE.PointLight(0xff3300, 0.4, 15);
    backLight.position.set(0, 2, 5);
    group.add(backLight);

    // Storage crates in back
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0.5,
      roughness: 0.6,
    });

    for (let i = 0; i < 4; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), crateMat);
      crate.position.set(-4 + i * 2.5, -1.2, 7);
      group.add(crate);
    }

    // Warning stripes on floor near back
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 1), stripeMat);
      stripe.position.set(-3 + i * 1.2, -1.84, 4);
      group.add(stripe);
    }

    return group;
  }, []);

  const createDistantObjects = useCallback(() => {
    const group = new THREE.Group();

    // Distant planet
    const planetGeo = new THREE.SphereGeometry(200, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.1,
      roughness: 0.9,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.set(-800, 200, -1500);
    group.add(planet);

    // Planet ring
    const ringGeo = new THREE.RingGeometry(280, 350, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xaa8866,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(planet.position);
    ring.rotation.x = Math.PI / 2.5;
    group.add(ring);

    // Sun (distant light source)
    const sunGeo = new THREE.SphereGeometry(100, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffff88,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(1500, 500, -2000);
    group.add(sun);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(150, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    group.add(glow);

    // Space station in distance
    const stationGroup = new THREE.Group();
    const stationMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.9,
      roughness: 0.3,
    });

    const stationCore = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 100, 16), stationMat);
    stationCore.rotation.x = Math.PI / 2;
    stationGroup.add(stationCore);

    const stationRing = new THREE.Mesh(new THREE.TorusGeometry(60, 8, 8, 32), stationMat);
    stationGroup.add(stationRing);

    stationGroup.position.set(400, -100, -800);
    group.add(stationGroup);

    return group;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.0001);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    camera.position.set(0, 0, -4);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    controls.addEventListener('lock', () => {
      setIsLocked(true);
      setShowInstructions(false);
    });
    controls.addEventListener('unlock', () => setIsLocked(false));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x111122, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffee, 1);
    sunLight.position.set(100, 50, -100);
    scene.add(sunLight);

    // Add objects
    const stars = createStarfield();
    starsRef.current = stars;
    scene.add(stars);

    const cockpit = createCockpit();
    shipGroupRef.current = cockpit;
    scene.add(cockpit);

    const distantObjects = createDistantObjects();
    scene.add(distantObjects);

    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === 'Tab') {
        e.preventDefault();
        setMode((prev) => (prev === 'flight' ? 'walking' : 'flight'));
      }
      if (e.code === 'Escape') {
        setShowInstructions(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation
    const clock = new THREE.Clock();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const keys = keysRef.current;

      if (isLocked || controlsRef.current?.isLocked) {
        const currentMode = mode;

        if (currentMode === 'walking') {
          // Walking mode
          const moveSpeed = 5;
          const velocity = velocityRef.current;
          velocity.x *= 0.9;
          velocity.z *= 0.9;

          if (keys.has('KeyW')) velocity.z -= moveSpeed * delta;
          if (keys.has('KeyS')) velocity.z += moveSpeed * delta;
          if (keys.has('KeyA')) velocity.x -= moveSpeed * delta;
          if (keys.has('KeyD')) velocity.x += moveSpeed * delta;

          controls.moveRight(velocity.x);
          controls.moveForward(-velocity.z);

          // Clamp position to cockpit bounds
          camera.position.x = Math.max(-5, Math.min(5, camera.position.x));
          camera.position.z = Math.max(-8, Math.min(8, camera.position.z));
          camera.position.y = 0;
        } else {
          // Flight mode
          const shipVelocity = shipVelocityRef.current;

          // Throttle control
          if (keys.has('KeyW')) {
            shipVelocity.z = Math.max(shipVelocity.z - 20 * delta, -100);
          }
          if (keys.has('KeyS')) {
            shipVelocity.z = Math.min(shipVelocity.z + 15 * delta, 50);
          }

          // Strafe
          if (keys.has('KeyA')) {
            shipVelocity.x = Math.max(shipVelocity.x - 10 * delta, -30);
          }
          if (keys.has('KeyD')) {
            shipVelocity.x = Math.min(shipVelocity.x + 10 * delta, 30);
          }

          // Vertical
          if (keys.has('Space')) {
            shipVelocity.y = Math.min(shipVelocity.y + 10 * delta, 30);
          }
          if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
            shipVelocity.y = Math.max(shipVelocity.y - 10 * delta, -30);
          }

          // Apply drag
          shipVelocity.multiplyScalar(0.995);

          // Move ship (and everything attached)
          if (shipGroupRef.current && starsRef.current) {
            shipGroupRef.current.position.add(shipVelocity.clone().multiplyScalar(delta));
            starsRef.current.position.add(shipVelocity.clone().multiplyScalar(delta * 0.1));
          }

          // Update ship state for HUD
          setShipState((prev) => ({
            ...prev,
            speed: Math.abs(shipVelocity.z) * 10,
            throttle: Math.max(0, -shipVelocity.z / 100) * 100,
            pitch: camera.rotation.x * 57.3,
            roll: camera.rotation.z * 57.3,
            yaw: camera.rotation.y * 57.3,
            fuel: Math.max(0, prev.fuel - Math.abs(shipVelocity.z) * 0.0001),
          }));
        }
      }

      // Rotate stars slowly for ambiance
      if (starsRef.current) {
        starsRef.current.rotation.y += 0.00005;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [createStarfield, createCockpit, createDistantObjects, mode]);

  const handleStart = () => {
    controlsRef.current?.lock();
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* CRT Scanline Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-10"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* HUD Overlay */}
      {isLocked && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-2 md:p-4 flex justify-between items-start">
            <div className="space-y-1 md:space-y-2">
              <div className="text-amber-500 text-xs md:text-sm tracking-wider opacity-80">
                <span className="text-teal-400">MODE:</span>{' '}
                {mode === 'flight' ? 'FLIGHT CONTROL' : 'EVA WALKING'}
              </div>
              <div className="text-amber-500/60 text-[10px] md:text-xs">
                [TAB] TOGGLE MODE
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-amber-500 text-xs md:text-sm tracking-wider">
                AEGIS DYNAMICS
              </div>
              <div className="text-amber-500/60 text-[10px] md:text-xs">
                SIDEWINDER MK-IV
              </div>
            </div>
          </div>

          {/* Flight HUD Elements */}
          {mode === 'flight' && (
            <>
              {/* Center Reticle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative w-16 h-16 md:w-24 md:h-24">
                  <div className="absolute top-0 left-1/2 w-0.5 h-3 md:h-4 bg-amber-500/60 -translate-x-1/2" />
                  <div className="absolute bottom-0 left-1/2 w-0.5 h-3 md:h-4 bg-amber-500/60 -translate-x-1/2" />
                  <div className="absolute left-0 top-1/2 w-3 md:w-4 h-0.5 bg-amber-500/60 -translate-y-1/2" />
                  <div className="absolute right-0 top-1/2 w-3 md:w-4 h-0.5 bg-amber-500/60 -translate-y-1/2" />
                  <div className="absolute inset-3 md:inset-4 border border-amber-500/40 rounded-full" />
                </div>
              </div>

              {/* Left Panel - Speed/Throttle */}
              <div className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 space-y-3 md:space-y-4">
                <div className="bg-black/40 border border-amber-500/30 p-2 md:p-3 rounded backdrop-blur-sm">
                  <div className="text-amber-500/60 text-[10px] md:text-xs mb-1">VELOCITY</div>
                  <div className="text-amber-400 text-lg md:text-2xl font-bold tabular-nums">
                    {shipState.speed.toFixed(0)}
                    <span className="text-xs md:text-sm ml-1 opacity-60">m/s</span>
                  </div>
                </div>

                <div className="bg-black/40 border border-amber-500/30 p-2 md:p-3 rounded backdrop-blur-sm">
                  <div className="text-amber-500/60 text-[10px] md:text-xs mb-1">THROTTLE</div>
                  <div className="w-4 md:w-6 h-24 md:h-32 bg-black/60 border border-amber-500/30 relative">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-600 to-amber-400"
                      style={{ height: `${shipState.throttle}%` }}
                    />
                  </div>
                  <div className="text-amber-400 text-xs md:text-sm mt-1 tabular-nums">
                    {shipState.throttle.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Right Panel - Ship Systems */}
              <div className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 space-y-2 md:space-y-3">
                <div className="bg-black/40 border border-teal-500/30 p-2 md:p-3 rounded backdrop-blur-sm">
                  <div className="text-teal-500/60 text-[10px] md:text-xs mb-2">SHIELDS</div>
                  <div className="w-16 md:w-24 h-2 bg-black/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-600 to-teal-400"
                      style={{ width: `${shipState.shields}%` }}
                    />
                  </div>
                  <div className="text-teal-400 text-xs md:text-sm mt-1">{shipState.shields}%</div>
                </div>

                <div className="bg-black/40 border border-green-500/30 p-2 md:p-3 rounded backdrop-blur-sm">
                  <div className="text-green-500/60 text-[10px] md:text-xs mb-2">HULL</div>
                  <div className="w-16 md:w-24 h-2 bg-black/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-600 to-green-400"
                      style={{ width: `${shipState.hull}%` }}
                    />
                  </div>
                  <div className="text-green-400 text-xs md:text-sm mt-1">{shipState.hull}%</div>
                </div>

                <div className="bg-black/40 border border-orange-500/30 p-2 md:p-3 rounded backdrop-blur-sm">
                  <div className="text-orange-500/60 text-[10px] md:text-xs mb-2">FUEL</div>
                  <div className="w-16 md:w-24 h-2 bg-black/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-600 to-orange-400"
                      style={{ width: `${shipState.fuel}%` }}
                    />
                  </div>
                  <div className="text-orange-400 text-xs md:text-sm mt-1">{shipState.fuel.toFixed(1)}%</div>
                </div>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-16 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-4 md:gap-8">
                <div className="text-center">
                  <div className="text-amber-500/60 text-[10px] md:text-xs">PITCH</div>
                  <div className="text-amber-400 text-sm md:text-lg tabular-nums">
                    {shipState.pitch.toFixed(1)}°
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-amber-500/60 text-[10px] md:text-xs">YAW</div>
                  <div className="text-amber-400 text-sm md:text-lg tabular-nums">
                    {shipState.yaw.toFixed(1)}°
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-amber-500/60 text-[10px] md:text-xs">ROLL</div>
                  <div className="text-amber-400 text-sm md:text-lg tabular-nums">
                    {shipState.roll.toFixed(1)}°
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Walking Mode Indicator */}
          {mode === 'walking' && (
            <div className="absolute bottom-16 md:bottom-8 left-1/2 -translate-x-1/2">
              <div className="bg-black/60 border border-teal-500/40 px-4 md:px-6 py-2 md:py-3 rounded backdrop-blur-sm">
                <div className="text-teal-400 text-xs md:text-sm tracking-wider text-center">
                  EXPLORING SHIP INTERIOR
                </div>
                <div className="text-teal-400/60 text-[10px] md:text-xs mt-1 text-center">
                  WASD to move • Mouse to look
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-gradient-to-b from-gray-900 to-black border border-amber-500/30 rounded-lg p-6 md:p-8 shadow-2xl shadow-amber-500/10">
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-2xl md:text-4xl font-bold text-amber-400 tracking-wider mb-2">
                VOID RUNNER
              </h1>
              <p className="text-amber-500/60 text-xs md:text-sm tracking-widest">
                SPACE EXPLORATION SIMULATOR
              </p>
            </div>

            <div className="space-y-4 md:space-y-6 text-sm md:text-base">
              <div className="border-l-2 border-amber-500/50 pl-4">
                <h3 className="text-teal-400 font-semibold mb-2">FLIGHT MODE</h3>
                <ul className="text-gray-300 space-y-1 text-xs md:text-sm">
                  <li><span className="text-amber-400">W/S</span> - Throttle forward/reverse</li>
                  <li><span className="text-amber-400">A/D</span> - Strafe left/right</li>
                  <li><span className="text-amber-400">SPACE/SHIFT</span> - Ascend/Descend</li>
                  <li><span className="text-amber-400">MOUSE</span> - Look around</li>
                </ul>
              </div>

              <div className="border-l-2 border-teal-500/50 pl-4">
                <h3 className="text-teal-400 font-semibold mb-2">WALKING MODE</h3>
                <ul className="text-gray-300 space-y-1 text-xs md:text-sm">
                  <li><span className="text-amber-400">WASD</span> - Walk around ship</li>
                  <li><span className="text-amber-400">MOUSE</span> - Look around</li>
                </ul>
              </div>

              <div className="border-l-2 border-orange-500/50 pl-4">
                <h3 className="text-orange-400 font-semibold mb-2">CONTROLS</h3>
                <ul className="text-gray-300 space-y-1 text-xs md:text-sm">
                  <li><span className="text-amber-400">TAB</span> - Toggle flight/walking mode</li>
                  <li><span className="text-amber-400">ESC</span> - Show this menu</li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full mt-6 md:mt-8 py-3 md:py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold tracking-wider rounded transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-sm md:text-base"
            >
              LAUNCH SIMULATION
            </button>

            <p className="text-center text-gray-500 text-[10px] md:text-xs mt-4">
              Click to lock pointer • ESC to unlock
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
        <p className="text-gray-600 text-[10px] md:text-xs tracking-wide">
          Requested by <span className="text-gray-500">@pablothethinker</span> · Built by <span className="text-gray-500">@clonkbot</span>
        </p>
      </div>
    </div>
  );
}

export default App;
