"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function createStudioEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Rich sky-pearl to ocean-teal studio dome for crisp glass highlights
    const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
    baseGrad.addColorStop(0, "#ffffff");
    baseGrad.addColorStop(0.32, "#bae6fd");
    baseGrad.addColorStop(0.65, "#5eead4");
    baseGrad.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Soft bright specular studio light panels
    const glow1 = ctx.createRadialGradient(140, 75, 10, 140, 75, 110);
    glow1.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    glow1.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 512, 256);

    const glow2 = ctx.createRadialGradient(390, 120, 12, 390, 120, 125);
    glow2.addColorStop(0, "rgba(186, 230, 253, 0.9)");
    glow2.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, 512, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function CalmOrbScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();

    // Procedural studio environment map so glass & iridescence visibly shimmer
    const pmrem = new THREE.PMREMGenerator(renderer);
    const equirectTex = createStudioEnvironmentTexture();
    const envTarget = pmrem.fromEquirectangular(equirectTex);
    scene.environment = envTarget.texture;
    equirectTex.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      60
    );
    camera.position.set(0, 0.2, 9.2);

    // Balanced light rig
    const ambient = new THREE.AmbientLight(0xe0f2fe, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(6, 7, 6);
    scene.add(keyLight);

    const oceanLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    oceanLight.position.set(-6, 2, 4);
    scene.add(oceanLight);

    const mintLight = new THREE.PointLight(0x2dd4bf, 2.4, 24);
    mintLight.position.set(3, -3, 5);
    scene.add(mintLight);

    // Hero Sculpture Group (flowing iridescent glass knot + floating satellites)
    const sculptureGroup = new THREE.Group();
    const getBasePos = (w: number) =>
      w >= 1024 ? { x: 2.8, y: 0.45 } : { x: 0.6, y: 1.2 };
    const initPos = getBasePos(window.innerWidth);
    sculptureGroup.position.set(initPos.x, initPos.y, -0.4);
    scene.add(sculptureGroup);

    // Flowing organic glass torus knot
    const knotGeo = new THREE.TorusKnotGeometry(1.32, 0.36, 180, 32, 2, 3);
    const knotMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#60a5fa"),
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 1,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [140, 560],
      sheen: 0.85,
      sheenColor: new THREE.Color("#99f6e4"),
      envMapIntensity: 1.7,
      transparent: true,
      opacity: 0.88,
    });
    const knotMesh = new THREE.Mesh(knotGeo, knotMat);
    sculptureGroup.add(knotMesh);

    // Subtle glass halo ring
    const haloGeo = new THREE.TorusGeometry(2.55, 0.025, 24, 160);
    const haloMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0ea5e9"),
      roughness: 0.15,
      metalness: 0.2,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.42,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.set(Math.PI / 2.8, Math.PI / 6, 0);
    sculptureGroup.add(haloMesh);

    // Floating depth glass spheres around the canvas
    const satGeo1 = new THREE.SphereGeometry(0.62, 48, 48);
    const satMat1 = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#38bdf8"),
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1,
      iridescence: 0.9,
      envMapIntensity: 1.6,
      transparent: true,
      opacity: 0.78,
    });
    const satMesh1 = new THREE.Mesh(satGeo1, satMat1);
    satMesh1.position.set(-3.9, 1.5, -1.6);
    scene.add(satMesh1);

    const satGeo2 = new THREE.SphereGeometry(0.42, 40, 40);
    const satMat2 = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#2dd4bf"),
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 1,
      iridescence: 0.8,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.74,
    });
    const satMesh2 = new THREE.Mesh(satGeo2, satMat2);
    satMesh2.position.set(-3.1, -1.6, 0.6);
    scene.add(satMesh2);

    const satGeo3 = new THREE.SphereGeometry(0.28, 32, 32);
    const satMat3 = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#818cf8"),
      roughness: 0.18,
      clearcoat: 1,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.62,
    });
    const satMesh3 = new THREE.Mesh(satGeo3, satMat3);
    satMesh3.position.set(1.1, -2.1, 0.9);
    scene.add(satMesh3);

    // Calm undulating 3D horizon wave mesh at bottom
    const waveGeo = new THREE.PlaneGeometry(26, 12, 48, 22);
    const waveBaseZ = new Float32Array(waveGeo.attributes.position.count);
    for (let i = 0; i < waveBaseZ.length; i++) {
      waveBaseZ[i] = waveGeo.attributes.position.getZ(i);
    }
    const waveMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#0284c7"),
      wireframe: true,
      transparent: true,
      opacity: 0.09,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.rotation.x = -Math.PI / 2.35;
    waveMesh.position.set(0, -2.85, -3.5);
    scene.add(waveMesh);

    // Smooth mouse parallax state
    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      if (!renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      const pos = getBasePos(window.innerWidth);
      sculptureGroup.position.x = pos.x;
      sculptureGroup.position.y = pos.y;
    };
    window.addEventListener("resize", onResize);

    const timer = new THREE.Timer();
    timer.connect(document);

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      let elapsed = 0;
      const posAttr = waveGeo.attributes.position;

      renderer.setAnimationLoop(() => {
        timer.update();
        const dt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
        elapsed += dt;

        // Smooth rotation of centerpiece sculpture
        knotMesh.rotation.y += dt * 0.14;
        knotMesh.rotation.x += dt * 0.07;
        haloMesh.rotation.z += dt * 0.1;

        // Gentle floating spheres
        satMesh1.position.y = 1.5 + Math.sin(elapsed * 0.55) * 0.25;
        satMesh2.position.y = -1.6 + Math.cos(elapsed * 0.65) * 0.22;
        satMesh3.position.y = -2.1 + Math.sin(elapsed * 0.8 + 1.2) * 0.18;

        // Undulating calm wave mesh
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const z =
            waveBaseZ[i] +
            Math.sin(vx * 0.45 + elapsed * 0.7) * 0.28 +
            Math.cos(vy * 0.55 + elapsed * 0.5) * 0.22;
          posAttr.setZ(i, z);
        }
        posAttr.needsUpdate = true;

        // Subtle pointer parallax
        const base = getBasePos(window.innerWidth);
        const targetX = base.x + pointerX * 0.36;
        const targetY = base.y + Math.sin(elapsed * 0.6) * 0.14 + pointerY * 0.24;

        sculptureGroup.position.x +=
          (targetX - sculptureGroup.position.x) * Math.min(1, dt * 2.8);
        sculptureGroup.position.y +=
          (targetY - sculptureGroup.position.y) * Math.min(1, dt * 2.8);

        camera.position.x +=
          (pointerX * 0.25 - camera.position.x) * Math.min(1, dt * 2);
        camera.position.y +=
          (0.2 + pointerY * 0.15 - camera.position.y) * Math.min(1, dt * 2);
        camera.lookAt(0, 0, -0.5);

        renderer?.render(scene, camera);
      });
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer?.setAnimationLoop(null);
      timer.dispose();
      envTarget.dispose();
      knotGeo.dispose();
      knotMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      satGeo1.dispose();
      satMat1.dispose();
      satGeo2.dispose();
      satMat2.dispose();
      satGeo3.dispose();
      satMat3.dispose();
      waveGeo.dispose();
      waveMat.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
