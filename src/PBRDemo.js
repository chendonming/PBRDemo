import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import GUI from 'lil-gui';

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = worldPosition.xyz;
    vNormal = normalMatrix * normal;
  }
`;

const fragmentShader = `
  uniform vec3 uAlbedo;
  uniform float uMetalness;
  uniform float uRoughness;
  uniform vec3 uLightPosition;
  uniform vec3 uCameraPosition;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  const float PI = 3.14159265359;

  vec3 F_Schlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
  }

  float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom);
  }

  float G_SchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
  }

  float G_Smith(float NdotV, float NdotL, float roughness) {
    return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = normalize(uLightPosition - vWorldPosition);
    vec3 H = normalize(V + L);
    
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, uAlbedo, uMetalness);
    
    vec3 F = F_Schlick(VdotH, F0);
    float D = D_GGX(NdotH, uRoughness);
    float G = G_Smith(NdotV, NdotL, uRoughness);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.0001;
    vec3 specular = numerator / denominator;
    
    vec3 kD = (vec3(1.0) - F) * (1.0 - uMetalness);
    vec3 diffuse = kD * uAlbedo / PI;
    
    vec3 color = (diffuse + specular) * NdotL;
    
    vec3 ambient = vec3(0.03) * uAlbedo;
    color += ambient;
    
    color = pow(color, vec3(1.0/2.2));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

const PBRDemo = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;

    // 场景设置
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    // 控制器
    const controls = new OrbitControls(camera, renderer.domElement);

    // 创建一个球体
    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAlbedo: { value: new THREE.Color(0x70f915) },
        uMetalness: { value: 0.201 },
        uRoughness: { value: 0.115 },
        uLightPosition: { value: new THREE.Vector3(5, 5, 5) },
        uCameraPosition: { value: camera.position }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });
    const torusKnot = new THREE.Mesh(geometry, material);
    scene.add(torusKnot);

    // 设置相机位置
    camera.position.z = 5;

    // 添加光源
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(5, 5, 5);
    scene.add(light);

    // 创建 GUI
    const gui = new GUI();
    const params = {
      albedo: material.uniforms.uAlbedo.value.getHex(),
      metalness: material.uniforms.uMetalness.value,
      roughness: material.uniforms.uRoughness.value,
      lightX: light.position.x,
      lightY: light.position.y,
      lightZ: light.position.z
    };

    gui.addColor(params, 'albedo').onChange((value) => {
      material.uniforms.uAlbedo.value.setHex(value);
    });
    gui.add(params, 'metalness', 0, 1).onChange((value) => {
      material.uniforms.uMetalness.value = value;
    });
    gui.add(params, 'roughness', 0, 1).onChange((value) => {
      material.uniforms.uRoughness.value = value;
    });
    gui.add(params, 'lightX', -10, 10).onChange((value) => {
      light.position.x = value;
      material.uniforms.uLightPosition.value.x = value;
    });
    gui.add(params, 'lightY', -10, 10).onChange((value) => {
      light.position.y = value;
      material.uniforms.uLightPosition.value.y = value;
    });
    gui.add(params, 'lightZ', -10, 10).onChange((value) => {
      light.position.z = value;
      material.uniforms.uLightPosition.value.z = value;
    });

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      // torusKnot.rotation.x += 0.01;
      // torusKnot.rotation.y += 0.01;
      controls.update();
      material.uniforms.uCameraPosition.value.copy(camera.position);
      renderer.render(scene, camera);
    };
    animate();

    // 清理函数
    return () => {
      currentMount.removeChild(renderer.domElement);
      gui.destroy();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default PBRDemo;
