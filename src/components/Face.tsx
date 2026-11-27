import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pointer } from '../hooks/pointerStore';

const EYE_X = 0.295;
const EYE_Y = 0.08;
const EYE_Z = 0.725;
const EYE_RADIUS = 0.126;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(d: number, sigma: number): number {
  const s = d / sigma;
  return Math.exp(-0.5 * s * s);
}

function gauss2(dx: number, sx: number, dy: number, sy: number): number {
  const a = dx / sx;
  const b = dy / sy;
  return Math.exp(-0.5 * (a * a + b * b));
}

function createHeadGeometry(): THREE.BufferGeometry {
  const segW = 144;
  const segH = 108;
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;

  const colors = new Float32Array(count * 3);
  const baseSkin = new THREE.Color('#cfa084');
  const blushTint = new THREE.Color('#c97e6b');
  const lipTint = new THREE.Color('#9e5752');
  const aoTint = new THREE.Color('#3b221b');
  const browTint = new THREE.Color('#5a4035');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const ax = Math.abs(ux);
    const signX = ux < 0 ? -1 : 1;

    // Base cranial & facial envelope
    let rx = 0.73;
    const ry = 1.07;
    let rz = 0.9;

    // Cranium fullness at upper back, temple narrowing at mid-upper sides
    const upperBack = smoothstep(-0.1, 0.55, uy) * smoothstep(0.25, -0.55, uz);
    rx += upperBack * 0.045;
    rz += upperBack * 0.08;

    const templeMask =
      smoothstep(0.42, 0.78, ax) *
      gauss(uy - 0.24, 0.22) *
      gauss(uz - 0.25, 0.32);
    rx -= templeMask * 0.055;

    // Taper lower face toward jawline and chin
    const lowerTaper = smoothstep(0.05, -0.98, uy);
    rx *= 1 - lowerTaper * 0.34;
    // Keep mandibular angle defined on the mid-lower sides
    const jawAngle =
      smoothstep(0.38, 0.72, ax) *
      gauss(uy + 0.52, 0.18) *
      gauss(uz + 0.02, 0.34);
    rx += jawAngle * 0.07;

    // Flatten and tuck occiput/nape into neck
    const napeTuck = smoothstep(-0.28, -0.82, uy) * smoothstep(0.1, -0.65, uz);
    rz *= 1 - napeTuck * 0.34;
    rx *= 1 - napeTuck * 0.12;

    // Subtle submental (under-chin) carve
    const underChin = smoothstep(-0.62, -0.96, uy) * smoothstep(-0.15, 0.45, uz);
    rz -= underChin * 0.07;

    let x = ux * rx;
    let y = uy * ry;
    let z = uz * rz;

    const frontMask = smoothstep(-0.12, 0.28, uz);
    const sideFrontMask = smoothstep(-0.25, 0.2, uz);

    let lipMask = 0;
    let aoAmount = 0;
    let blushAmount = 0;
    let browShade = 0;

    if (frontMask > 0.0001) {
      const fx = Math.abs(x);
      const fy = y;

      // Forehead plane & gentle slope
      const forehead = gauss2(fx, 0.42, fy - 0.52, 0.24) * frontMask;
      z += forehead * 0.042;
      const foreheadSlope = smoothstep(0.38, 0.92, fy) * frontMask;
      z -= foreheadSlope * 0.055;

      // Brow ridge (supraorbital arch)
      const browCurveY = 0.27 - 0.22 * (fx - 0.21) * (fx - 0.21);
      const browRidge =
        gauss(fy - browCurveY, 0.052) *
        smoothstep(0.56, 0.36, fx) *
        frontMask;
      const glabella = gauss2(fx, 0.09, fy - 0.23, 0.065) * frontMask;
      z += browRidge * 0.068 + glabella * 0.032;
      browShade = clamp(browRidge * smoothstep(0.06, 0.14, fx) * 0.45, 0, 1);

      // Orbital eye sockets
      const eyeDx = fx - EYE_X;
      const eyeDy = fy - EYE_Y;
      const socket = gauss2(eyeDx, 0.142, eyeDy, 0.092) * frontMask;
      const socketInner = gauss2(eyeDx, 0.095, eyeDy, 0.062) * frontMask;
      z -= socket * 0.145 + socketInner * 0.055;
      aoAmount = Math.max(aoAmount, socket * 0.42 + socketInner * 0.35);

      // Tear trough / under-eye transition
      const underEyeBag =
        gauss2(fx - EYE_X, 0.14, fy - (EYE_Y - 0.115), 0.035) * frontMask;
      z += underEyeBag * 0.018;

      // Nasal root (nasion) dip
      const nasion = gauss2(fx, 0.065, fy - 0.135, 0.055) * frontMask;
      z -= nasion * 0.025;

      // Nasal bridge
      const bridgeT = clamp((0.12 - fy) / 0.37, 0, 1);
      const bridgeYMask =
        smoothstep(0.18, 0.07, fy) * smoothstep(-0.33, -0.2, fy);
      const bridgeWidth = 0.046 + bridgeT * 0.026;
      const bridgeProfile = 0.05 + Math.pow(bridgeT, 0.85) * 0.185;
      const bridge = gauss(fx, bridgeWidth) * bridgeYMask * frontMask;
      z += bridge * bridgeProfile;

      // Nose tip (lobule)
      const noseTip = gauss2(fx, 0.068, fy + 0.245, 0.056) * frontMask;
      z += noseTip * 0.072;
      y -= noseTip * 0.018;
      blushAmount = Math.max(blushAmount, noseTip * 0.35);

      // Alae (nostril wings)
      const alae = gauss2(fx - 0.102, 0.044, fy + 0.275, 0.042) * frontMask;
      z += alae * 0.078;
      x += signX * alae * 0.028;

      // Nostril openings & under-nose shadow
      const nostril = gauss2(fx - 0.058, 0.026, fy + 0.312, 0.022) * frontMask;
      z -= nostril * 0.062;
      y += nostril * 0.015;
      aoAmount = Math.max(aoAmount, nostril * 0.82);

      // Columella (bridge between nostrils)
      const columella = gauss2(fx, 0.02, fy + 0.295, 0.038) * frontMask;
      z += columella * 0.032;

      // Philtrum groove & philtral columns
      const philtrum = gauss2(fx, 0.026, fy + 0.395, 0.048) * frontMask;
      const philtrumRidge =
        gauss2(fx - 0.048, 0.02, fy + 0.395, 0.048) * frontMask;
      z -= philtrum * 0.02;
      z += philtrumRidge * 0.012;

      // Cheekbones (zygomatic arch)
      const cheekBone =
        gauss2(fx - 0.42, 0.145, fy + 0.085, 0.11) * sideFrontMask;
      const cheekOuter =
        gauss2(fx - 0.54, 0.11, fy + 0.02, 0.095) * sideFrontMask;
      z += cheekBone * 0.068 + cheekOuter * 0.025;
      x += signX * (cheekBone * 0.038 + cheekOuter * 0.035);
      blushAmount = Math.max(blushAmount, cheekBone * 0.28);

      // Subtle sub-malar hollow for sculptural plane definition
      const malarHollow =
        gauss2(fx - 0.43, 0.12, fy + 0.34, 0.13) * sideFrontMask;
      z -= malarHollow * 0.024;
      x -= signX * malarHollow * 0.022;

      // Nasolabial fullness
      const nasolabial =
        gauss2(fx - 0.21, 0.08, fy + 0.35, 0.11) * frontMask;
      z += nasolabial * 0.024;

      // Mouth & Lips
      const mouthWidthMask = smoothstep(0.265, 0.04, fx);
      const mouthSeamY = -0.515 + 0.016 * Math.pow(fx / 0.24, 2);

      // Upper lip with Cupid's bow
      const cupidsBow =
        0.015 * gauss(fx - 0.058, 0.036) - 0.01 * gauss(fx, 0.028);
      const upperLipY = mouthSeamY + 0.042 + cupidsBow;
      const upperLip =
        gauss(fy - upperLipY, 0.033) * mouthWidthMask * frontMask;

      // Lower lip
      const lowerLipWidth = smoothstep(0.235, 0.03, fx);
      const lowerLipY = mouthSeamY - 0.052;
      const lowerLip =
        gauss(fy - lowerLipY, 0.042) * lowerLipWidth * frontMask;

      // Oral fissure (crease between lips)
      const mouthSeam =
        gauss(fy - mouthSeamY, 0.015) *
        smoothstep(0.255, 0.12, fx) *
        frontMask;

      // Mouth corner tuck (modiolus)
      const mouthCorner =
        gauss2(fx - 0.25, 0.038, fy - mouthSeamY, 0.032) * frontMask;

      z += upperLip * 0.072 + lowerLip * 0.076;
      z -= mouthSeam * 0.056 + mouthCorner * 0.028;

      lipMask = clamp(
        (upperLip * 0.92 + lowerLip * 0.95) * (1 - mouthSeam * 0.3),
        0,
        1
      );
      aoAmount = Math.max(aoAmount, mouthSeam * 0.72 + mouthCorner * 0.28);

      // Mentolabial sulcus (cleft under lower lip)
      const chinDip = gauss2(fx, 0.15, fy + 0.675, 0.052) * frontMask;
      z -= chinDip * 0.046;
      aoAmount = Math.max(aoAmount, chinDip * 0.18);

      // Chin prominence (mentum)
      const chin = gauss2(fx, 0.165, fy + 0.855, 0.105) * frontMask;
      z += chin * 0.095;
      y -= chin * 0.024;
    }

    // Submental / under-jaw shadow
    const underJawAO = smoothstep(-0.78, -1.04, y) * smoothstep(0.65, -0.35, z);
    aoAmount = Math.max(aoAmount, underJawAO * 0.34);

    pos.setXYZ(i, x, y, z);

    // Vertex color shading (skin tone, subtle subsurface warmth, lips, AO)
    tmpColor.copy(baseSkin);
    if (blushAmount > 0.001) {
      tmpColor.lerp(blushTint, blushAmount * 0.45);
    }
    if (lipMask > 0.001) {
      tmpColor.lerp(lipTint, lipMask * 0.68);
    }
    if (browShade > 0.001) {
      tmpColor.lerp(browTint, browShade * 0.32);
    }
    if (aoAmount > 0.001) {
      tmpColor.lerp(aoTint, clamp(aoAmount, 0, 0.88));
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  // Subtle symmetric Laplacian smoothing pass on the sphere grid (preserves detail, eliminates micro-pinching)
  const stride = segW + 1;
  const scratchX = new Float32Array(count);
  const scratchY = new Float32Array(count);
  const scratchZ = new Float32Array(count);

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      scratchX[i] = pos.getX(i);
      scratchY[i] = pos.getY(i);
      scratchZ[i] = pos.getZ(i);
    }

    for (let iy = 1; iy < segH; iy++) {
      for (let ix = 0; ix <= segW; ix++) {
        const idx = iy * stride + ix;
        const leftIx = ix === 0 ? segW - 1 : ix - 1;
        const rightIx = ix === segW ? 1 : ix + 1;

        const iL = iy * stride + leftIx;
        const iR = iy * stride + rightIx;
        const iU = (iy - 1) * stride + ix;
        const iD = (iy + 1) * stride + ix;

        const cx = scratchX[idx] ?? 0;
        const cy = scratchY[idx] ?? 0;
        const cz = scratchZ[idx] ?? 0;

        // Reduce smoothing on fine central facial features (lips, nostrils, sockets)
        const isDetail =
          cz > 0.45 && Math.abs(cx) < 0.42 && cy > -0.68 && cy < 0.28;
        const weight = isDetail ? 0.14 : 0.28;

        const avgX =
          ((scratchX[iL] ?? 0) +
            (scratchX[iR] ?? 0) +
            (scratchX[iU] ?? 0) +
            (scratchX[iD] ?? 0)) *
          0.25;
        const avgY =
          ((scratchY[iL] ?? 0) +
            (scratchY[iR] ?? 0) +
            (scratchY[iU] ?? 0) +
            (scratchY[iD] ?? 0)) *
          0.25;
        const avgZ =
          ((scratchZ[iL] ?? 0) +
            (scratchZ[iR] ?? 0) +
            (scratchZ[iU] ?? 0) +
            (scratchZ[iD] ?? 0)) *
          0.25;

        pos.setXYZ(
          idx,
          cx + (avgX - cx) * weight,
          cy + (avgY - cy) * weight,
          cz + (avgZ - cz) * weight
        );
      }
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Stitch seam normals cleanly between ix = 0 and ix = segW
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  for (let iy = 0; iy <= segH; iy++) {
    const i0 = iy * stride;
    const i1 = iy * stride + segW;
    const nx = (norm.getX(i0) + norm.getX(i1)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(i1)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(i1)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;

  return geo;
}

function createNeckGeometry(): THREE.BufferGeometry {
  const segR = 64;
  const segH = 36;
  const geo = new THREE.CylinderGeometry(0.41, 0.49, 1.15, segR, segH, true);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const baseSkin = new THREE.Color('#cba085');
  const shadowTone = new THREE.Color('#5b3a2e');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x0 = pos.getX(i);
    const y0 = pos.getY(i); // -0.575 .. +0.575
    const z0 = pos.getZ(i);

    const t = (y0 + 0.575) / 1.15; // 0 = bottom bust, 1 = top inside head
    const angle = Math.atan2(x0, z0);
    const ax = Math.abs(Math.sin(angle));
    const front = Math.cos(angle);

    // Subtle organic hourglass neck profile flaring into trapezius/shoulders at base
    const baseFlare = Math.pow(1 - smoothstep(0, 0.42, t), 2);
    let rx = 0.4 + baseFlare * 0.34;
    let rz = 0.42 + baseFlare * 0.14;

    // Slight forward shift at top to sit naturally beneath skull
    const zShift = -0.14 + (1 - t) * 0.05;

    // Sternocleidomastoid (SCM) ridges descending diagonally toward sternum
    const scmTargetAngle = 0.22 + t * 0.92;
    const scmRidge =
      gauss(Math.abs(angle) - scmTargetAngle, 0.2) *
      smoothstep(0.08, 0.28, t) *
      smoothstep(0.95, 0.65, t);
    rx += scmRidge * 0.022;
    rz += scmRidge * 0.022;

    // Subtle laryngeal / throat contour
    const throat =
      gauss(angle, 0.25) * gauss(t - 0.56, 0.14) * smoothstep(0.2, 0.6, front);
    rz += throat * 0.018;

    // Suprasternal notch indentation at front base
    const notch = gauss(angle, 0.28) * gauss(t - 0.14, 0.09);
    rz -= notch * 0.032;

    // Trapezius slope on outer sides at bottom
    const trapDrop = baseFlare * ax * 0.12;

    const x = Math.sin(angle) * rx;
    const y = y0 - 1.18 - trapDrop;
    const z = Math.cos(angle) * rz + zShift;

    pos.setXYZ(i, x, y, z);

    // Submental shadow under chin & fade slightly into darkness at bust bottom
    const underChinShadow =
      smoothstep(0.45, 0.96, t) * smoothstep(-0.3, 0.85, front) * 0.58;
    const bottomFade = Math.pow(1 - smoothstep(0, 0.22, t), 1.6) * 0.55;
    const shade = clamp(Math.max(underChinShadow, bottomFade), 0, 0.78);

    tmpColor.copy(baseSkin).lerp(shadowTone, shade);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createEarGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 36, 28);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const baseSkin = new THREE.Color('#cc9a80');
  const innerShade = new THREE.Color('#5b3429');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Sculpted C-shaped outer ear (built for right side; mirrored for left via scale.x = -1)
    let x = ux * 0.068;
    let y = uy * 0.215;
    let z = uz * 0.128;

    // Narrower toward the earlobe
    const lobeTaper = smoothstep(0.15, -0.9, uy);
    z *= 1 - lobeTaper * 0.28;
    // Slight backward sweep at top
    z -= smoothstep(-0.2, 0.85, uy) * 0.028;

    // Outer face (+X) helix rim & concha hollow
    const outerFace = smoothstep(-0.15, 0.45, ux);
    const radialDist = Math.hypot(uy * 0.92, (uz + 0.1) * 1.1);
    const helixRim = gauss(radialDist - 0.78, 0.18) * outerFace;
    const conchaHollow =
      gauss2(uy + 0.08, 0.45, uz - 0.12, 0.42) * outerFace;
    const tragus = gauss2(uy + 0.14, 0.22, uz - 0.62, 0.22) * outerFace;

    x += helixRim * 0.026 - conchaHollow * 0.044 + tragus * 0.022;

    // Soft hanging earlobe
    const lobe = gauss2(uy + 0.78, 0.26, uz - 0.05, 0.45);
    y -= lobe * 0.02;
    x += lobe * 0.008;

    pos.setXYZ(i, x, y, z);

    const ao = clamp(conchaHollow * 0.72 + (1 - outerFace) * 0.25, 0, 0.8);
    tmpColor.copy(baseSkin).lerp(innerShade, ao);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createScleraGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(EYE_RADIUS, 36, 28);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const white = new THREE.Color('#ebe7e2');
  const cornerTint = new THREE.Color('#cbb5b0');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const zNorm = pos.getZ(i) / EYE_RADIUS;
    const edgeTint = smoothstep(0.65, -0.2, zNorm) * 0.52;
    tmpColor.copy(white).lerp(cornerTint, edgeTint);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function createIrisGeometry(): THREE.BufferGeometry {
  const radialSegs = 56;
  const ringSegs = 10;
  const innerR = 0.017;
  const outerR = 0.056;
  const geo = new THREE.RingGeometry(innerR, outerR, radialSegs, ringSegs);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const limbalColor = new THREE.Color('#131922');
  const outerIris = new THREE.Color('#355163');
  const midIris = new THREE.Color('#5a7a88');
  const collarette = new THREE.Color('#9a7b4f');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    const u = clamp((r - innerR) / (outerR - innerR), 0, 1);
    const angle = Math.atan2(y, x);

    // Slight spherical curvature to hug the front of the eyeball
    const z = Math.sqrt(Math.max(0.0001, EYE_RADIUS * EYE_RADIUS - r * r)) + 0.0012;
    pos.setZ(i, z);

    // Deterministic fibrous radial striations
    const fibers =
      0.5 +
      0.28 * Math.sin(angle * 24 + u * 3.1) +
      0.16 * Math.cos(angle * 43 - u * 4.7) +
      0.12 * Math.sin(angle * 67 + u * 1.9);

    if (u < 0.28) {
      const t = u / 0.28;
      tmpColor.copy(collarette).lerp(midIris, smoothstep(0.1, 1, t));
    } else if (u < 0.82) {
      const t = (u - 0.28) / 0.54;
      tmpColor.copy(midIris).lerp(outerIris, t);
    } else {
      const t = (u - 0.82) / 0.18;
      tmpColor.copy(outerIris).lerp(limbalColor, smoothstep(0, 1, t));
    }

    const brightness = 0.84 + fibers * 0.3;
    tmpColor.multiplyScalar(brightness);

    colors[i * 3] = clamp(tmpColor.r, 0, 1);
    colors[i * 3 + 1] = clamp(tmpColor.g, 0, 1);
    colors[i * 3 + 2] = clamp(tmpColor.b, 0, 1);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createUpperEyelidGeometry(): THREE.BufferGeometry {
  const radius = EYE_RADIUS + 0.011;
  // Partial upper dome wrapping over the front-top of the eyeball
  const geo = new THREE.SphereGeometry(
    radius,
    32,
    18,
    Math.PI * 0.08,
    Math.PI * 0.84,
    Math.PI * 0.12,
    Math.PI * 0.42
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const lidSkin = new THREE.Color('#c39278');
  const lashLine = new THREE.Color('#3c241d');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Subtle lid margin thickening along the lower front rim
    const rimMask = smoothstep(0.035, -0.025, y) * smoothstep(0.02, 0.11, z);
    const scale = 1 + rimMask * 0.032;
    pos.setXYZ(i, x * scale, y * scale, z * scale);

    tmpColor.copy(lidSkin).lerp(lashLine, rimMask * 0.72);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createLowerEyelidGeometry(): THREE.BufferGeometry {
  const radius = EYE_RADIUS + 0.009;
  const geo = new THREE.SphereGeometry(
    radius,
    32,
    14,
    Math.PI * 0.1,
    Math.PI * 0.8,
    Math.PI * 0.56,
    Math.PI * 0.28
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const lidSkin = new THREE.Color('#c4947a');
  const rimShade = new THREE.Color('#7c5043');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const rim = smoothstep(-0.07, -0.015, y);
    tmpColor.copy(lidSkin).lerp(rimShade, rim * 0.35);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createEyebrowGeometry(): THREE.BufferGeometry {
  // Sculpted organic arch for right brow (mirrored for left)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.095, 0.242, 0.848),
    new THREE.Vector3(0.22, 0.278, 0.822),
    new THREE.Vector3(0.36, 0.274, 0.742),
    new THREE.Vector3(0.49, 0.228, 0.618),
  ]);
  const geo = new THREE.TubeGeometry(curve, 24, 0.022, 10, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0 = inner head, 1 = outer tail
    const center = curve.getPointAt(clamp(u, 0, 1));
    const dx = pos.getX(i) - center.x;
    const dy = pos.getY(i) - center.y;
    const dz = pos.getZ(i) - center.z;

    // Taper smoothly at inner head and sharper outer tail, flatten slightly against brow bone
    const taper =
      smoothstep(0, 0.16, u) * (1 - smoothstep(0.52, 1, u) * 0.82);
    pos.setXYZ(
      i,
      center.x + dx * taper * 1.05,
      center.y + dy * taper * 0.92,
      center.z + dz * taper * 0.55
    );
  }

  geo.computeVertexNormals();
  return geo;
}

interface SpringState { v: number }
const SPRING_K = 55;
const SPRING_C = 9.2; // damping ratio ~0.62
function spring(st: SpringState, target: number, dt: number, cur: number): number {
  const a = SPRING_K * (target - cur) - SPRING_C * st.v;
  st.v += a * dt;
  return cur + st.v * dt;
}

export default function FaceModel() {
  const headWorld = useMemo(() => new THREE.Vector3(), []);
  const lean = useRef({ near: 0 }).current;
  const spr = useRef({ rx: { v: 0 }, ry: { v: 0 }, rz: { v: 0 } }).current;
  const rootGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftUpperLidRef = useRef<THREE.Group>(null);
  const rightUpperLidRef = useRef<THREE.Group>(null);

  const animRef = useRef({
    elapsed: 0,
    nextBlinkTime: 3.6,
    blinkProgress: -1,
    blinkDuration: 0.17,
    blinkCount: 0,
  });

  const resources = useMemo(() => {
    const headGeo = createHeadGeometry();
    const neckGeo = createNeckGeometry();
    const earGeo = createEarGeometry();
    const scleraGeo = createScleraGeometry();
    const irisGeo = createIrisGeometry();
    const pupilGeo = new THREE.CircleGeometry(0.02, 32);
    const corneaGeo = new THREE.SphereGeometry(
      EYE_RADIUS + 0.0035,
      28,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.34
    );
    corneaGeo.rotateX(Math.PI * 0.5);

    const glintGeo = new THREE.SphereGeometry(0.009, 12, 12);
    const upperLidGeo = createUpperEyelidGeometry();
    const lowerLidGeo = createLowerEyelidGeometry();
    const eyebrowGeo = createEyebrowGeometry();
    const socketBackGeo = new THREE.SphereGeometry(EYE_RADIUS + 0.012, 20, 16);
    const mouthCavityGeo = new THREE.SphereGeometry(0.17, 20, 14);
    mouthCavityGeo.scale(1.25, 0.36, 0.72);

    const skinMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.58,
      sheen: 0.32,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color('#f0c8b0'),
      ior: 1.4,
      reflectivity: 0.35,
    });

    const lidMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.54,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.52,
      sheen: 0.28,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#ebc3ac'),
      side: THREE.DoubleSide,
    });

    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.38,
    });

    const irisMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
    });

    const pupilMat = new THREE.MeshBasicMaterial({
      color: '#040507',
    });

    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.14,
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.42,
      depthWrite: false,
    });

    const glintMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
    });

    const cavityMat = new THREE.MeshStandardMaterial({
      color: '#120808',
      roughness: 0.95,
      metalness: 0.0,
    });

    const browMat = new THREE.MeshStandardMaterial({
      color: '#251c17',
      roughness: 0.88,
      metalness: 0.0,
    });

    return {
      geometries: {
        headGeo,
        neckGeo,
        earGeo,
        scleraGeo,
        irisGeo,
        pupilGeo,
        corneaGeo,
        glintGeo,
        upperLidGeo,
        lowerLidGeo,
        eyebrowGeo,
        socketBackGeo,
        mouthCavityGeo,
      },
      materials: {
        skinMat,
        lidMat,
        scleraMat,
        irisMat,
        pupilMat,
        corneaMat,
        glintMat,
        cavityMat,
        browMat,
      },
    };
  }, []);

  useEffect(() => {
    const { geometries, materials } = resources;
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [resources]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const anim = animRef.current;
    anim.elapsed += delta;
    const t = anim.elapsed;

    const head = headGroupRef.current;
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    const leftLid = leftUpperLidRef.current;
    const rightLid = rightUpperLidRef.current;

    if (!head || !leftEye || !rightEye || !leftLid || !rightLid) {
      return;
    }

    let targetHeadY = 0;
    let targetHeadX = 0;
    let targetHeadZ = 0;
    let targetEyeY = 0;
    let targetEyeX = 0;
    let targetPosY = 0;
    let targetPosX = 0;
    let targetPosZ = 0;
    let targetScale = 1;

    // Proximity: how close the cursor is to the head on screen (0 far .. 1 on top of it)
    let nearTarget = 0;
    let leanX = 0;
    let leanY = 0;
    if (pointer.active) {
      head.getWorldPosition(headWorld);
      headWorld.project(state.camera);
      const dx = pointer.x - headWorld.x;
      const dy = pointer.y - -headWorld.y;
      const dist = Math.hypot(dx * (state.size.width / state.size.height), dy);
      const u = clamp(1 - dist / 1.1, 0, 1);
      nearTarget = u * u * (3 - 2 * u);
      leanX = clamp(dx, -1, 1);
      leanY = clamp(dy, -1, 1);
    }
    lean.near = THREE.MathUtils.damp(lean.near, nearTarget, 4, delta);
    pointer.near = lean.near;
    const near = lean.near;

    if (pointer.active) {
      const px = clamp(pointer.x, -1, 1);
      const py = clamp(pointer.y, -1, 1);

      targetHeadY = px * 0.55;
      targetHeadX = py * 0.28;
      targetHeadZ = -px * 0.04;

      // Eyes additionally rotate toward pointer relative to the head
      // Eyes lead: they aim at the full gaze direction before the head catches up.
      targetEyeY = clamp(px * 0.28 + (targetHeadY - head.rotation.y) * 0.9, -0.34, 0.34);
      targetEyeX = clamp(py * 0.18 + (targetHeadX - head.rotation.x) * 0.9, -0.24, 0.24);

      // Lean toward the cursor when it comes close.
      targetHeadY += leanX * 0.12 * near;
      targetHeadX += leanY * 0.10 * near + 0.05 * near;
      targetHeadZ += -leanX * 0.09 * near;
      targetPosX = leanX * 0.16 * near;
      targetPosY = -leanY * 0.10 * near;
      targetPosZ = 0.22 * near;
      targetScale = 1 + 0.035 * near;
    } else {
      // Subtle idle: slow sinusoidal head sway, breathing scale ±0.4%, gentle bob
      targetHeadY = Math.sin(t * 0.42) * 0.13 + Math.sin(t * 0.19) * 0.05;
      targetHeadX = Math.sin(t * 0.31 + 0.7) * 0.05;
      targetHeadZ = Math.sin(t * 0.26 + 1.4) * 0.022;

      targetEyeY = clamp(Math.sin(t * 0.62 + 0.5) * 0.065, -0.28, 0.28);
      targetEyeX = clamp(Math.sin(t * 0.47 + 1.1) * 0.032, -0.18, 0.18);

      targetScale = 1 + Math.sin(t * 1.35) * 0.004;
      targetPosY = Math.sin(t * 1.35 - 0.55) * 0.018;
    }

    // Smooth head & eye tracking with THREE.MathUtils.damp
    // Head follows with a slightly under-damped spring (soft, small overshoot).
    head.rotation.y = spring(spr.ry, targetHeadY, delta, head.rotation.y);
    head.rotation.x = spring(spr.rx, targetHeadX, delta, head.rotation.x);
    head.rotation.z = spring(spr.rz, targetHeadZ, delta, head.rotation.z);

    head.position.x = THREE.MathUtils.damp(head.position.x, targetPosX, 4, delta);
    head.position.z = THREE.MathUtils.damp(head.position.z, targetPosZ, 4, delta);
    head.position.y = THREE.MathUtils.damp(head.position.y, targetPosY, 3.5, delta);
    const nextScale = THREE.MathUtils.damp(head.scale.x, targetScale, 3.5, delta);
    head.scale.set(nextScale, nextScale, nextScale);

    const nextEyeY = THREE.MathUtils.damp(leftEye.rotation.y, targetEyeY, 20.0, delta);
    const nextEyeX = THREE.MathUtils.damp(leftEye.rotation.x, targetEyeX, 20.0, delta);
    leftEye.rotation.y = nextEyeY;
    leftEye.rotation.x = nextEyeX;
    rightEye.rotation.y = nextEyeY;
    rightEye.rotation.x = nextEyeX;

    // Natural blinking every ~4 seconds (smooth asymmetric close/open dip)
    if (anim.blinkProgress < 0 && t >= anim.nextBlinkTime) {
      anim.blinkProgress = 0;
      anim.blinkCount += 1;
      const jitter = Math.sin(anim.blinkCount * 2.37) * 0.45;
      anim.nextBlinkTime = t + 4.0 + jitter;
    }

    let blinkAmount = 0;
    if (anim.blinkProgress >= 0) {
      anim.blinkProgress += delta / anim.blinkDuration;
      if (anim.blinkProgress >= 1) {
        anim.blinkProgress = -1;
        blinkAmount = 0;
      } else if (anim.blinkProgress < 0.4) {
        const u = anim.blinkProgress / 0.4;
        blinkAmount = u * u * (3 - 2 * u);
      } else {
        const u = (anim.blinkProgress - 0.4) / 0.6;
        blinkAmount = 1 - u * u * (3 - 2 * u);
      }
    }

    // Upper eyelid rests open, follows vertical gaze slightly, and dips smoothly on blink
    const lidAngle = -0.22 + nextEyeX * 0.42 + blinkAmount * 0.58;
    leftLid.rotation.x = lidAngle;
    rightLid.rotation.x = lidAngle;
  });

  const { geometries, materials } = resources;

  return (
    <group ref={rootGroupRef} position={[0, 0.14, 0]}>
      <group ref={headGroupRef}>
        {/* Main sculpted cranium & face */}
        <mesh
          geometry={geometries.headGeo}
          material={materials.skinMat}
          castShadow
          receiveShadow
        />

        {/* Sculpted neck & upper bust */}
        <mesh
          geometry={geometries.neckGeo}
          material={materials.skinMat}
          castShadow
          receiveShadow
        />

        {/* Right & Left sculpted ears */}
        <mesh
          geometry={geometries.earGeo}
          material={materials.skinMat}
          position={[0.725, -0.04, -0.055]}
          rotation={[0.06, -0.26, -0.14]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometries.earGeo}
          material={materials.skinMat}
          position={[-0.725, -0.04, -0.055]}
          rotation={[0.06, 0.26, 0.14]}
          scale={[-1, 1, 1]}
          castShadow
          receiveShadow
        />

        {/* Sculpted eyebrows */}
        <mesh
          geometry={geometries.eyebrowGeo}
          material={materials.browMat}
          receiveShadow
        />
        <mesh
          geometry={geometries.eyebrowGeo}
          material={materials.browMat}
          scale={[-1, 1, 1]}
          receiveShadow
        />

        {/* Inner dark mouth cavity backing */}
        <mesh
          geometry={geometries.mouthCavityGeo}
          material={materials.cavityMat}
          position={[0, -0.515, 0.635]}
        />

        {/* Right eye assembly */}
        <group position={[EYE_X, EYE_Y, EYE_Z]}>
          <mesh
            geometry={geometries.socketBackGeo}
            material={materials.cavityMat}
            position={[0, 0, -0.032]}
          />
          <group ref={rightEyeRef}>
            <mesh
              geometry={geometries.scleraGeo}
              material={materials.scleraMat}
            />
            <mesh
              geometry={geometries.irisGeo}
              material={materials.irisMat}
            />
            <mesh
              geometry={geometries.pupilGeo}
              material={materials.pupilMat}
              position={[0, 0, EYE_RADIUS + 0.0018]}
            />
            <mesh
              geometry={geometries.corneaGeo}
              material={materials.corneaMat}
            />
            <mesh
              geometry={geometries.glintGeo}
              material={materials.glintMat}
              position={[0.022, 0.024, EYE_RADIUS + 0.005]}
            />
          </group>
          <group ref={rightUpperLidRef} rotation={[-0.22, 0, 0]}>
            <mesh
              geometry={geometries.upperLidGeo}
              material={materials.lidMat}
              castShadow
              receiveShadow
            />
          </group>
          <mesh
            geometry={geometries.lowerLidGeo}
            material={materials.lidMat}
            receiveShadow
          />
        </group>

        {/* Left eye assembly */}
        <group position={[-EYE_X, EYE_Y, EYE_Z]}>
          <mesh
            geometry={geometries.socketBackGeo}
            material={materials.cavityMat}
            position={[0, 0, -0.032]}
          />
          <group ref={leftEyeRef}>
            <mesh
              geometry={geometries.scleraGeo}
              material={materials.scleraMat}
            />
            <mesh
              geometry={geometries.irisGeo}
              material={materials.irisMat}
            />
            <mesh
              geometry={geometries.pupilGeo}
              material={materials.pupilMat}
              position={[0, 0, EYE_RADIUS + 0.0018]}
            />
            <mesh
              geometry={geometries.corneaGeo}
              material={materials.corneaMat}
            />
            <mesh
              geometry={geometries.glintGeo}
              material={materials.glintMat}
              position={[0.022, 0.024, EYE_RADIUS + 0.005]}
            />
          </group>
          <group ref={leftUpperLidRef} rotation={[-0.22, 0, 0]}>
            <mesh
              geometry={geometries.upperLidGeo}
              material={materials.lidMat}
              castShadow
              receiveShadow
            />
          </group>
          <mesh
            geometry={geometries.lowerLidGeo}
            material={materials.lidMat}
            receiveShadow
          />
        </group>
      </group>
    </group>
  );
}

