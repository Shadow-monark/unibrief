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
    baseGrad.addColorStop(0.32, "#bae6fd");
    baseGrad.addColorStop(0.68, "#2dd4bf");
    baseGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 256);

    const glow1 = ctx.createRadialGradient(130, 70, 8, 130, 70, 120);
    glow1.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    glow1.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 512, 256);

    const glow2 = ctx.createRadialGradient(380, 140, 10, 380, 140, 130);
    glow2.addColorStop(0, "rgba(125, 211, 252, 0.95)");
    glow2.addColorStop(1, "rgba(125, 211, 252, 0)");
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

function paintVerticalIdCardFace(
  canvas: HTMLCanvasElement,
  profile: StudentProfile
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  drawRoundedRectPath(ctx, 10, 10, W - 20, H - 20, 52);
  ctx.clip();

  // Translucent tinted glass gradient across portrait pass
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.58)");
  sheen.addColorStop(0.5, "rgba(224, 242, 254, 0.24)");
  sheen.addColorStop(1, "rgba(14, 165, 233, 0.28)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // Crisp bright glass edge frame
  drawRoundedRectPath(ctx, 14, 14, W - 28, H - 28, 48);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Top Lanyard Punch Slot
  drawRoundedRectPath(ctx, W / 2 - 72, 46, 144, 26, 13);
  ctx.fillStyle = "rgba(15, 23, 42, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Brand & Verified Pill
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.font = "700 38px system-ui, -apple-system, sans-serif";
  ctx.fillText("UNIBRIEF", W / 2, 148);

  ctx.fillStyle = "rgba(30, 58, 95, 0.78)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("STUDENT DIGITAL ACCESS PASS", W / 2, 182);

  // Verified Status Pill
  drawRoundedRectPath(ctx, W / 2 - 92, 208, 184, 42, 21);
  ctx.fillStyle = "rgba(16, 185, 129, 0.20)";
  ctx.fill();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2 - 58, 229, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#059669";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#065f46";
  ctx.font = "700 18px monospace";
  ctx.fillText("VERIFIED", W / 2 - 42, 235);

  // Portrait Avatar Frame
  const avSize = 236;
  const avX = W / 2 - avSize / 2;
  const avY = 290;
  drawRoundedRectPath(ctx, avX, avY, avSize, avSize, 42);
  ctx.fillStyle = "rgba(255, 255, 255, 0.56)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Clean Silhouette
  ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
  ctx.beginPath();
  ctx.arc(W / 2, avY + 88, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W / 2, avY + 196, 76, 52, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Student Details (Live reactive)
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  const branchText =
    profile.branch === "All" ? "B.TECH · ALL" : `B.TECH · ${profile.branch}`;
  ctx.fillText(branchText, W / 2, 608);

  ctx.fillStyle = "rgba(30, 58, 95, 0.85)";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `Semester ${profile.semester}  •  ${profile.residence}`,
    W / 2,
    654
  );

  // Smart Chip + ID Number Row
  drawRoundedRectPath(ctx, 76, 718, 96, 68, 14);
  ctx.fillStyle = "rgba(226, 232, 240, 0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(71, 85, 105, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(76, 752);
  ctx.lineTo(172, 752);
  ctx.moveTo(124, 718);
  ctx.lineTo(124, 786);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.font = "600 21px monospace";
  ctx.fillText("ID: UB-2026-0304", 204, 746);
  ctx.fillStyle = "rgba(51, 65, 85, 0.72)";
  ctx.font = "500 18px monospace";
  ctx.fillText("VALID: AY 2026–27", 204, 780);

  // Hairline Divider
  ctx.beginPath();
  ctx.moveTo(76, 840);
  ctx.lineTo(W - 76, 840);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sharp Laser-Etched Bottom Barcode
  const barWidths = [
    6, 3, 9, 4, 3, 7, 3, 6, 9, 3, 4, 8, 3, 6, 4, 9, 4, 6, 3, 8, 4, 5, 8, 3,
    6, 4, 7, 3, 6,
  ];
  const totalBarW =
    barWidths.reduce((sum, w) => sum + w, 0) + (barWidths.length - 1) * 7;
  let cursor = (W - totalBarW) / 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
  for (const w of barWidths) {
    ctx.fillRect(cursor, 886, w, 92);
    cursor += w + 7;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(51, 65, 85, 0.7)";
  ctx.font = "500 16px monospace";
  ctx.fillText("CAMPUS SMART CREDENTIAL", W / 2, 1022);

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
      paintVerticalIdCardFace(faceCanvasRef.current, profile);
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
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();

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
    camera.position.set(0, 0, 9.4);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xf1f5f9, 1.3);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const coolRim = new THREE.DirectionalLight(0x38bdf8, 1.8);
    coolRim.position.set(-6, -2, 5);
    scene.add(coolRim);

    const mintFill = new THREE.PointLight(0x2dd4bf, 2.0, 22);
    mintFill.position.set(2, -3, 5);
    scene.add(mintFill);

    // Vertical Portrait ID Card Dimensions
    const cardW = 2.72;
    const cardH = 4.28;
    const cardRadius = 0.22;
    const cardShape = createRoundedCardShape(cardW, cardH, cardRadius);

    const cardGroup = new THREE.Group();
    const getBasePos = (w: number) => {
      if (w >= 1400) return { x: 4.15, y: 0.05 };
      if (w >= 1024) return { x: 3.35, y: 0.05 };
      return { x: 0.85, y: 0.45 };
    };
    const initPos = getBasePos(window.innerWidth);
    cardGroup.position.set(initPos.x, initPos.y, 0.2);
    cardGroup.rotation.set(0.06, -0.28, -0.05);
    scene.add(cardGroup);

    // Translucent Ocean-Tinted Glass Slab (higher clarity & specular pop)
    const slabGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    slabGeo.center();

    const slabMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7dd3fc"),
      roughness: 0.09,
      metalness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      iridescence: 0.9,
      iridescenceIOR: 1.35,
      envMapIntensity: 1.9,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    cardGroup.add(slabMesh);

    // Crisp Metallic Lanyard Clasp Ring at Top of Vertical Card
    const claspGeo = new THREE.TorusGeometry(0.18, 0.03, 16, 48);
    const claspMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#94a3b8"),
      roughness: 0.2,
      metalness: 0.85,
      envMapIntensity: 1.8,
    });
    const claspMesh = new THREE.Mesh(claspGeo, claspMat);
    claspMesh.position.set(0, cardH / 2 + 0.14, 0);
    cardGroup.add(claspMesh);

    // High-DPI Vertical Laser-Etched ID Card Face
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = 768;
    faceCanvas.height = 1200;
    paintVerticalIdCardFace(faceCanvas, profile);
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
    faceMesh.position.z = 0.078;
    cardGroup.add(faceMesh);

    // Deep Slate-Teal Translucent Backing Card for High-Contrast Glass Refraction
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
      color: new THREE.Color("#0f766e"),
      roughness: 0.22,
      clearcoat: 0.8,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.34,
    });
    const backCardMesh = new THREE.Mesh(backCardGeo, backCardMat);
    backCardMesh.position.set(-0.55, -0.35, -0.85);
    backCardMesh.rotation.set(0.04, 0.14, 0.08);
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

        const base = getBasePos(window.innerWidth);
        cardGroup.position.x = base.x;
        cardGroup.position.y = base.y + Math.sin(elapsed * 0.55) * 0.14;
        cardGroup.rotation.y = -0.28 + Math.sin(elapsed * 0.35) * 0.14;
        cardGroup.rotation.x = 0.06 + Math.cos(elapsed * 0.4) * 0.05;

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
      claspGeo.dispose();
      claspMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      faceTex.dispose();
      backCardGeo.dispose();
      backCardMat.dispose();
      renderer?.dispose();
    };
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
