"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

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
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    camera.position.set(0, 0, 8.5);

    // Serene atmospheric studio lighting
    const ambient = new THREE.AmbientLight(0xf1f5f9, 1.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 2.4);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x99f6e4, 1.6);
    rimLight.position.set(-6, -3, 4);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xbfdbfe, 2.2, 20);
    warmFill.position.set(3, -2, 4);
    scene.add(warmFill);

    // Main calm 3D glass sculpture group
    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(
      window.innerWidth >= 1024 ? 2.6 : 0,
      window.innerWidth >= 1024 ? 0.35 : 1.1,
      0
    );
    scene.add(sculptureGroup);

    // Translucent frosted crystal core
    const coreGeo = new THREE.IcosahedronGeometry(1.38, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#dbeafe"),
      roughness: 0.14,
      metalness: 0.05,
      transmission: 0.72,
      thickness: 1.5,
      ior: 1.38,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      iridescence: 0.65,
      iridescenceIOR: 1.3,
      transparent: true,
      opacity: 0.9,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    sculptureGroup.add(coreMesh);

    // Inner soft glowing pearl sphere
    const innerGeo = new THREE.SphereGeometry(0.66, 32, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#7dd3fc"),
      emissive: new THREE.Color("#93c5fd"),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      transparent: true,
      opacity: 0.55,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    sculptureGroup.add(innerMesh);

    // Calm orbital glass rings
    const ringGeo1 = new THREE.TorusGeometry(2.05, 0.018, 24, 140);
    const ringMat1 = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#93c5fd"),
      roughness: 0.2,
      metalness: 0.15,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.set(Math.PI / 3.2, Math.PI / 7, 0);
    sculptureGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(2.45, 0.012, 20, 140);
    const ringMat2 = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#99f6e4"),
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.set(-Math.PI / 3.5, Math.PI / 4, 0.4);
    sculptureGroup.add(ringMesh2);

    // Gentle ambient dust particles
    const particleCount = 90;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color("#64748b"),
      size: 0.045,
      transparent: true,
      opacity: 0.28,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

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
      sculptureGroup.position.set(
        window.innerWidth >= 1024 ? 2.6 : 0,
        window.innerWidth >= 1024 ? 0.35 : 1.1,
        0
      );
    };
    window.addEventListener("resize", onResize);

    const timer = new THREE.Timer();
    timer.connect(document);

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      let elapsed = 0;
      renderer.setAnimationLoop(() => {
        timer.update();
        const dt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
        elapsed += dt;

        coreMesh.rotation.y += dt * 0.16;
        coreMesh.rotation.x += dt * 0.09;
        ringMesh1.rotation.z += dt * 0.11;
        ringMesh2.rotation.z -= dt * 0.08;
        particles.rotation.y += dt * 0.025;

        const targetX =
          (window.innerWidth >= 1024 ? 2.6 : 0) + pointerX * 0.32;
        const targetY =
          (window.innerWidth >= 1024 ? 0.35 : 1.1) +
          Math.sin(elapsed * 0.65) * 0.14 +
          pointerY * 0.22;

        sculptureGroup.position.x +=
          (targetX - sculptureGroup.position.x) * Math.min(1, dt * 3);
        sculptureGroup.position.y +=
          (targetY - sculptureGroup.position.y) * Math.min(1, dt * 3);

        renderer?.render(scene, camera);
      });
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer?.setAnimationLoop(null);
      timer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-85"
    />
  );
}
