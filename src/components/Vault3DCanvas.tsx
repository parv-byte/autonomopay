'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Vault3DProps {
  status?: string; // 'IDLE' | 'CREATED' | 'FUNDED' | 'VERIFYING' | 'SETTLED' | 'PARTIAL' | 'REFUNDED';
  settlementPercentage?: number;
  className?: string;
  compact?: boolean;
}

export default function Vault3DCanvas({
  status = 'IDLE',
  settlementPercentage = 100,
  className = '',
  compact = false,
}: Vault3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // References to keep animation loop clean
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialsRef = useRef<{
    coreMat?: THREE.MeshPhysicalMaterial;
    innerMat?: THREE.MeshBasicMaterial;
    ringsMat?: THREE.MeshBasicMaterial;
    starsMat?: THREE.PointsMaterial;
  }>({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || (compact ? 320 : 480);
    const height = container.clientHeight || (compact ? 240 : 380);

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, compact ? 10 : 8.5);

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Architectural Lighting (Technomancy Arcane Cyber Key/Fill/Rim)
    const ambientLight = new THREE.AmbientLight(0x0a1628, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x00f0ff, 3.2, 60);
    keyLight.position.set(7, 7, 6);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x6366f1, 2.6, 60);
    rimLight.position.set(-7, -6, 6);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x38bdf8, 2.0, 60);
    fillLight.position.set(0, 8, -6);
    scene.add(fillLight);

    // 1. Arcane Starlight Background (650+ Stars with Cyan, Indigo & Diamond)
    const starCount = 650;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const colorPalette = [
      new THREE.Color(0x00f0ff), // Electric Arcane Cyan
      new THREE.Color(0x38bdf8), // Sky Laser
      new THREE.Color(0x818cf8), // Mystic Indigo
      new THREE.Color(0xffffff), // Pure Diamond Star
    ];

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      starPositions[idx] = (Math.random() - 0.5) * 22;
      starPositions[idx + 1] = (Math.random() - 0.5) * 22;
      starPositions[idx + 2] = (Math.random() - 0.5) * 22;

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      starColors[idx] = c.r;
      starColors[idx + 1] = c.g;
      starColors[idx + 2] = c.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: compact ? 0.045 : 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    materialsRef.current.starsMat = starMat;
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 2. Technomancy Core Polyhedron (The Arcane Escrow Relic)
    const coreGeo = new THREE.IcosahedronGeometry(compact ? 1.4 : 1.7, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff, // Electric Arcane Cyan
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      roughness: 0.10,
      metalness: 0.85,
      wireframe: wireframe,
      transparent: true,
      opacity: 0.92,
    });
    materialsRef.current.coreMat = coreMat;
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // 3. Inner Diamond Nucleus
    const innerGeo = new THREE.OctahedronGeometry(compact ? 0.7 : 0.9, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });
    materialsRef.current.innerMat = innerMat;
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // 4. Arcane Technomancy Orbit Rings
    const ringGroup = new THREE.Group();
    const ringGeo1 = new THREE.TorusGeometry(compact ? 2.1 : 2.5, 0.022, 16, 120);
    const ringGeo2 = new THREE.TorusGeometry(compact ? 2.5 : 2.9, 0.020, 16, 120);
    const ringGeo3 = new THREE.TorusGeometry(compact ? 2.9 : 3.3, 0.016, 16, 120);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
    });
    materialsRef.current.ringsMat = ringMat;

    const ring1 = new THREE.Mesh(ringGeo1, ringMat);
    const ring2 = new THREE.Mesh(ringGeo2, ringMat);
    const ring3 = new THREE.Mesh(ringGeo3, ringMat);

    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring3.rotation.z = Math.PI / 6;

    ringGroup.add(ring1);
    ringGroup.add(ring2);
    ringGroup.add(ring3);
    scene.add(ringGroup);

    // 5. Orbiting Agent Nodes (Buyer, Verifier, Worker)
    const satellitesGroup = new THREE.Group();
    const planetGeo = new THREE.SphereGeometry(compact ? 0.18 : 0.22, 20, 20);

    // Buyer Agent (Ice Blue)
    const buyerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const buyerNode = new THREE.Mesh(planetGeo, buyerMat);
    satellitesGroup.add(buyerNode);

    // Verifier Agent (Platinum White)
    const verifierMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const verifierNode = new THREE.Mesh(planetGeo, verifierMat);
    satellitesGroup.add(verifierNode);

    // Worker Agent (Titanium Silver / Emerald Glow)
    const workerMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const workerNode = new THREE.Mesh(planetGeo, workerMat);
    satellitesGroup.add(workerNode);
    scene.add(satellitesGroup);

    // Mouse Interaction (Orbiting Drag & Cosmic Tilt)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        const rect = container.getBoundingClientRect();
        const normX = ((e.clientX - rect.left) / width - 0.5) * 2;
        const normY = ((e.clientY - rect.top) / height - 0.5) * 2;
        targetRotationY = normX * 0.45;
        targetRotationX = normY * 0.45;
        return;
      }
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      coreMesh.rotation.y += deltaX * 0.008;
      coreMesh.rotation.x += deltaY * 0.008;
      ringGroup.rotation.y += deltaX * 0.008;
      starField.rotation.y += deltaX * 0.002;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cosmic Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      if (autoRotate && !isDragging) {
        coreMesh.rotation.y += 0.006;
        coreMesh.rotation.x += 0.003;
        innerMesh.rotation.y -= 0.018;
        innerMesh.rotation.z += 0.009;

        ring1.rotation.x = Math.PI / 3 + Math.sin(elapsed * 0.5) * 0.16;
        ring1.rotation.y += 0.006;
        ring2.rotation.y = Math.PI / 4 + Math.cos(elapsed * 0.4) * 0.18;
        ring2.rotation.x += 0.007;
        ring3.rotation.z += 0.008;

        coreMesh.rotation.x += (targetRotationX - coreMesh.rotation.x) * 0.04;
      }

      // Planetary satellite orbits
      const radius = compact ? 2.6 : 3.0;
      buyerNode.position.x = Math.cos(elapsed * 0.85) * radius;
      buyerNode.position.z = Math.sin(elapsed * 0.85) * radius;
      buyerNode.position.y = Math.sin(elapsed * 1.4) * 0.5;

      verifierNode.position.x = Math.cos(elapsed * 0.85 + (Math.PI * 2) / 3) * radius;
      verifierNode.position.z = Math.sin(elapsed * 0.85 + (Math.PI * 2) / 3) * radius;
      verifierNode.position.y = Math.cos(elapsed * 1.1) * 0.6;

      workerNode.position.x = Math.cos(elapsed * 0.85 + (Math.PI * 4) / 3) * radius;
      workerNode.position.z = Math.sin(elapsed * 0.85 + (Math.PI * 4) / 3) * radius;
      workerNode.position.y = Math.sin(elapsed * 1.2) * 0.5;

      // Deep space starfield slow cosmic rotation
      starField.rotation.y = elapsed * 0.015;
      starField.rotation.x = elapsed * 0.008;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      coreGeo.dispose();
      innerGeo.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      ringGeo3.dispose();
      planetGeo.dispose();
      starGeo.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [compact, wireframe]);

  // Real-time Professional State Reaction
  useEffect(() => {
    const mats = materialsRef.current;
    if (!mats.coreMat || !mats.ringsMat) return;

    if (status === 'ATTACK_DETECTED' || status === 'ATTACK_BLOCKED') {
      // Ruby Crimson Adversarial Shield Interception
      mats.coreMat.color.setHex(0xef4444);
      mats.coreMat.emissive.setHex(0xb91c1c);
      mats.ringsMat.color.setHex(0xf87171);
      if (mats.innerMat) mats.innerMat.color.setHex(0xfca5a5);
    } else if (status === 'STREAMING') {
      // High-Frequency Energy Stream Cyan
      mats.coreMat.color.setHex(0x06b6d4);
      mats.coreMat.emissive.setHex(0x0e7490);
      mats.ringsMat.color.setHex(0x67e8f9);
      if (mats.innerMat) mats.innerMat.color.setHex(0xcffafe);
    } else if (status === 'SETTLED') {
      // Emerald Settlement Release
      mats.coreMat.color.setHex(0x10b981);
      mats.coreMat.emissive.setHex(0x047857);
      mats.ringsMat.color.setHex(0x34d399);
      if (mats.innerMat) mats.innerMat.color.setHex(0x6ee7b7);
    } else if (status === 'PARTIAL' || status === 'PARTIALLY_SETTLED') {
      // Reconciled Amber Partial Payout
      mats.coreMat.color.setHex(0xf59e0b);
      mats.coreMat.emissive.setHex(0xb45309);
      mats.ringsMat.color.setHex(0xfcd34d);
      if (mats.innerMat) mats.innerMat.color.setHex(0xfef3c7);
    } else if (status === 'VERIFYING' || status === 'VERIFICATION_PENDING') {
      // Pure Diamond Ice Verification
      mats.coreMat.color.setHex(0x38bdf8);
      mats.coreMat.emissive.setHex(0x0284c7);
      mats.ringsMat.color.setHex(0x7dd3fc);
      if (mats.innerMat) mats.innerMat.color.setHex(0xffffff);
    } else if (status === 'FUNDED' || status === 'AUTHORIZED') {
      // Technomancy Arcane Cyan Active Escrow Lock
      mats.coreMat.color.setHex(0x00f0ff);
      mats.coreMat.emissive.setHex(0x0284c7);
      mats.ringsMat.color.setHex(0x38bdf8);
      if (mats.innerMat) mats.innerMat.color.setHex(0xffffff);
    } else {
      // Default Arcane Core
      mats.coreMat.color.setHex(0x00f0ff);
      mats.coreMat.emissive.setHex(0x0369a1);
      mats.ringsMat.color.setHex(0x38bdf8);
      if (mats.innerMat) mats.innerMat.color.setHex(0xffffff);
    }
  }, [status, settlementPercentage]);

  return (
    <div className={`relative overflow-hidden rounded-2xl select-none ${className}`}>
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
        title="Interactive Vault: Click and drag to orbit in 3D"
      />

      {/* Silver Glassmorphic HUD Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 font-mono text-[10px]">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-slate-200 backdrop-blur-md shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse"></span>
          <span>TITANIUM ESCROW VAULT 3D</span>
        </div>
        <div className="text-slate-400 text-[9px] px-1">
          {status === 'PARTIALLY_SETTLED' || status === 'PARTIAL' ? (
            <span className="text-amber-400 font-bold">STATE: PARTIAL RATIO ({settlementPercentage}%)</span>
          ) : status === 'SETTLED' ? (
            <span className="text-emerald-400 font-bold">STATE: 100% CAPTURED & RELEASED</span>
          ) : status === 'VERIFYING' ? (
            <span className="text-sky-400 font-bold">STATE: MULTI-TIER VERIFICATION</span>
          ) : (
            <span className="text-slate-300 font-bold">STATE: CONDITIONAL ESCROW LOCK</span>
          )}
        </div>
      </div>

      {/* Silver Glass Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg text-[10px] font-mono">
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`px-2 py-1 rounded-lg transition-all ${
            wireframe ? 'bg-white/15 text-white border border-white/20' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Wireframe Mesh"
        >
          {wireframe ? 'Mesh: Wire' : 'Mesh: Solid'}
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2 py-1 rounded-lg transition-all ${
            autoRotate ? 'bg-white/15 text-white border border-white/20' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Auto-Rotation"
        >
          {autoRotate ? 'Orbit: ON' : 'Orbit: OFF'}
        </button>
      </div>

      {/* Agent Satellite Legend */}
      {!compact && (
        <div className="absolute bottom-3 left-3 pointer-events-none hidden sm:flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>Buyer Agent</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-200"></span>
            <span>Verifier Core</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Worker Agent</span>
          </div>
        </div>
      )}
    </div>
  );
}
