"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudentProfile } from "@/types/campus";

interface CalmOrbSceneProps {
  profile: StudentProfile;
}

function createStudioEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
    baseGrad.addColorStop(0, "#ffffff");
    baseGrad.addColorStop(0.35, "#dbeafe");
    baseGrad.addColorStop(0.7, "#99f6e4");
    baseGrad.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 256);

    const glow1 = ctx.createRadialGradient(130, 70, 8, 130, 70, 120);
    glow1.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    glow1.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 512, 256);

    const glow2 = ctx.createRadialGradient(380, 140, 10, 380, 140, 130);
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

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function paintIdCardFace(
  canvas: HTMLCanvasElement,
  profile: StudentProfile
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  drawRoundedRectPath(ctx, 8, 8, W - 16, H - 16, 48);
  ctx.clip();

  // Subtle diagonal frosted sheen across glass face
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.42)");
  sheen.addColorStop(0.45, "rgba(255, 255, 255, 0.10)");
  sheen.addColorStop(1, "rgba(186, 230, 253, 0.28)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // Subtle etched inner glass border
  drawRoundedRectPath(ctx, 12, 12, W - 24, H - 24, 44);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Top Header Strip
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.font = "700 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("ASKCAMPUS", 58, 78);

  ctx.fillStyle = "rgba(30, 58, 95, 0.58)";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.fillText("UNIVERSITY DIGITAL ID PASS", 58, 108);

  // Top-right Active Status Pill
  drawRoundedRectPath(ctx, W - 210, 48, 154, 40, 20);
  ctx.fillStyle = "rgba(16, 185, 129, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W - 184, 68, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#059669";
  ctx.fill();

  ctx.fillStyle = "#065f46";
  ctx.font = "600 16px monospace";
  ctx.fillText("VERIFIED", W - 166, 74);

  // Minimal Frosted Avatar Silhouette Box
  drawRoundedRectPath(ctx, 58, 164, 152, 186, 26);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Silhouette icon inside avatar box
  ctx.fillStyle = "rgba(30, 58, 95, 0.36)";
  ctx.beginPath();
  ctx.arc(134, 224, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(134, 306, 48, 34, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Smart Chip icon
  drawRoundedRectPath(ctx, 252, 174, 74, 54, 12);
  ctx.fillStyle = "rgba(203, 213, 225, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(252, 201);
  ctx.lineTo(326, 201);
  ctx.moveTo(289, 174);
  ctx.lineTo(289, 228);
  ctx.stroke();

  // Student Profile Details (Live reactive to Branch / Sem / Residence)
  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  ctx.font = "700 32px system-ui, -apple-system, sans-serif";
  const branchText =
    profile.branch === "All" ? "B.TECH ALL BRANCHES" : `B.TECH · ${profile.branch}`;
  ctx.fillText(branchText, 252, 280);

  ctx.fillStyle = "rgba(51, 65, 85, 0.72)";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `Semester ${profile.semester}  •  ${profile.residence}`,
    252,
    318
  );

  // Clean Hairline Divider
  ctx.beginPath();
  ctx.moveTo(58, 412);
  ctx.lineTo(W - 58, 412);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bottom Metadata + Minimal Barcode Stripes
  ctx.fillStyle = "rgba(71, 85, 105, 0.65)";
  ctx.font = "500 16px monospace";
  ctx.fillText("ID NO: AC-2026-0304", 58, 468);
  ctx.fillText("ACADEMIC YEAR 2026–27", 58, 498);

  // Subtle laser-etched barcode
  const barStart = W - 268;
  const barWidths = [4, 2, 6, 3, 2, 5, 2, 4, 6, 2, 3, 5, 2, 4, 2, 6, 3, 4];
  let cursor = barStart;
  ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
  for (const w of barWidths) {
    ctx.fillRect(cursor, 446, w, 58);
    cursor += w + 5;
  }

  ctx.restore();
}

function createRoundedCardShape(
  width: number,
  height: number,
  radius: number
): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

export function CalmOrbScene({ profile }: CalmOrbSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceTexRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (faceCanvasRef.current && faceTexRef.current) {
      paintIdCardFace(faceCanvasRef.current, profile);
      faceTexRef.current.needsUpdate = true;
    }
  }, [profile]);

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

    // Procedural studio sky reflections for crisp glass edge bevels
    const pmrem = new THREE.PMREMGenerator(renderer);
    const equirectTex = createStudioEnvironmentTexture();
    const envTarget = pmrem.fromEquirectangular(equirectTex);
    scene.environment = envTarget.texture;
    equirectTex.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    camera.position.set(0, 0, 9.2);
    camera.lookAt(0, 0, 0);

    // Serene studio lighting
    const ambient = new THREE.AmbientLight(0xf1f5f9, 1.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const coolRim = new THREE.DirectionalLight(0x7dd3fc, 1.6);
    coolRim.position.set(-6, -2, 5);
    scene.add(coolRim);

    const mintFill = new THREE.PointLight(0x99f6e4, 1.8, 22);
    mintFill.position.set(2, -3, 5);
    scene.add(mintFill);

    // Card Dimensions
    const cardW = 4.35;
    const cardH = 2.72;
    const cardRadius = 0.22;
    const cardShape = createRoundedCardShape(cardW, cardH, cardRadius);

    const cardGroup = new THREE.Group();
    const getBasePos = (w: number) =>
      w >= 1024 ? { x: 2.35, y: 0.1 } : { x: 0.25, y: 0.9 };
    const initPos = getBasePos(window.innerWidth);
    cardGroup.position.set(initPos.x, initPos.y, 0);
    cardGroup.rotation.set(0.08, -0.26, -0.04);
    scene.add(cardGroup);

    // Main Transparent Glass Slab (Beveled Rounded Rectangle)
    const slabGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    slabGeo.center();

    const slabMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#e0f2fe"),
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.65,
      iridescenceIOR: 1.32,
      envMapIntensity: 1.65,
      transparent: true,
      opacity: 0.44,
      side: THREE.DoubleSide,
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    cardGroup.add(slabMesh);

    // Crisp Laser-Etched Front Glass Face
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = 1024;
    faceCanvas.height = 640;
    paintIdCardFace(faceCanvas, profile);
    faceCanvasRef.current = faceCanvas;

    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.anisotropy = 4;
    faceTexRef.current = faceTex;

    const faceGeo = new THREE.PlaneGeometry(cardW + 0.03, cardH + 0.03);
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      depthWrite: false,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.062;
    cardGroup.add(faceMesh);

    // Subtle Echo Translucent Backing Rectangle for calm 3D depth
    const backCardGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    backCardGeo.center();

    const backCardMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#99f6e4"),
      roughness: 0.22,
      clearcoat: 0.8,
      envMapIntensity: 1.3,
      transparent: true,
      opacity: 0.22,
    });
    const backCardMesh = new THREE.Mesh(backCardGeo, backCardMat);
    backCardMesh.position.set(-0.65, -0.38, -0.95);
    backCardMesh.rotation.set(0.05, 0.14, 0.08);
    cardGroup.add(backCardMesh);

    const onResize = () => {
      if (!renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      const pos = getBasePos(window.innerWidth);
      cardGroup.position.x = pos.x;
      cardGroup.position.y = pos.y;
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

        // Calm steady floating & gentle breathing tilt (zero pointer-hover sway)
        const base = getBasePos(window.innerWidth);
        cardGroup.position.x = base.x;
        cardGroup.position.y = base.y + Math.sin(elapsed * 0.55) * 0.13;
        cardGroup.rotation.y = -0.26 + Math.sin(elapsed * 0.35) * 0.12;
        cardGroup.rotation.x = 0.08 + Math.cos(elapsed * 0.4) * 0.05;

        renderer?.render(scene, camera);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      renderer?.setAnimationLoop(null);
      timer.dispose();
      envTarget.dispose();
      slabGeo.dispose();
      slabMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      faceTex.dispose();
      backCardGeo.dispose();
      backCardMat.dispose();
      renderer?.dispose();
    };
    // Intentionally mounted once; profile updates repaint faceCanvas in separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
