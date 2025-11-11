import { useEffect, useRef } from "react";
import ThreeGlobe from "three-globe";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function GlobeComponent({ logs }) {
  const globeEl = useRef(null);

  useEffect(() => {
    // 🌍 Initialize the globe
    const myGlobe = new ThreeGlobe()
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
      .pointAltitude(0.005)
      .pointsData(logs.map(log => ({
        lat: log.latitude || getApproximateCoords(log.country, log.city).lat,
        lng: log.longitude || getApproximateCoords(log.country, log.city).lng,
        size: 0.1, // Set a consistent size for all points
        color: 'red' // All points are red for visibility
      })));

    // 💡 Setup the Three.js scene
    const myScene = new THREE.Scene();
    myScene.add(myGlobe);
    myScene.add(new THREE.AmbientLight(0xcccccc, 1));
    myScene.add(new THREE.DirectionalLight(0xffffff, 0.6));

    // 🖼️ Setup the renderer
    const width = 800;
    const height = 600;
    const myRenderer = new THREE.WebGLRenderer({ antialias: true });
    myRenderer.setSize(width, height);
    myRenderer.domElement.style.border = "2px solid #333";
    myRenderer.domElement.style.borderRadius = "10px";
    myRenderer.domElement.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";

    // 📷 Setup the camera
    const myCamera = new THREE.PerspectiveCamera();
    myCamera.aspect = width / height;
    myCamera.updateProjectionMatrix();
    myCamera.position.z = 250;

    // 🕹️ Setup controls
    const myControls = new OrbitControls(myCamera, myRenderer.domElement);
    myControls.enableDamping = true;
    myControls.dampingFactor = 0.25;
    myControls.screenSpacePanning = false;
    myControls.minDistance = 150;
    myControls.maxDistance = 500;

    // 🚀 Start animation loop
    (function animate() {
      myControls.update();
      myRenderer.render(myScene, myCamera);
      requestAnimationFrame(animate);
    })();

    // 🌐 Append the renderer's canvas to the ref
    globeEl.current.appendChild(myRenderer.domElement);

    // 🧹 Cleanup on component unmount
    return () => {
      myRenderer.domElement.remove();
      myRenderer.dispose();
      myControls.dispose();
    };
  }, [logs]);

  return <div ref={globeEl} />;
}

// 🌍 Helper: Approximate coordinates for countries
function getApproximateCoords(country, city) {
  const coords = {
    Nigeria: { lat: 9.082, lng: 8.6753 },
    "United States": { lat: 37.0902, lng: -95.7129 },
    "United Kingdom": { lat: 55.3781, lng: -3.436 },
    Germany: { lat: 51.1657, lng: 10.4515 },
    France: { lat: 46.2276, lng: 2.2137 },
    Japan: { lat: 36.2048, lng: 138.2529 },
    Australia: { lat: -25.2744, lng: 133.7751 },
    Canada: { lat: 56.1304, lng: -106.3468 },
    Brazil: { lat: -14.235, lng: -51.9253 },
    India: { lat: 20.5937, lng: 78.9629 },
    China: { lat: 35.8617, lng: 104.1954 },
    Russia: { lat: 61.524, lng: 105.3188 },
    "South Africa": { lat: -30.5595, lng: 22.9375 },
    Mexico: { lat: 23.6345, lng: -102.5528 },
    Argentina: { lat: -38.4161, lng: -63.6167 },
  };

  return coords[country] || { lat: Math.random() * 180 - 90, lng: Math.random() * 360 - 180 };
}

export default GlobeComponent;
