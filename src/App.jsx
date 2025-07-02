// File: App.jsx
import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, STLLoader } from '@react-three/drei';
import * as THREE from 'three';
import { saveAs } from 'file-saver';

function STLViewer({ geometry, highlightIndices }) {
  const colorArray = new Float32Array(geometry.attributes.position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    if (highlightIndices && highlightIndices.includes(i)) {
      color.set('red');
    } else {
      color.set('skyblue');
    }
    color.toArray(colorArray, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors={true} />
    </mesh>
  );
}

function mirrorGeometryExcludingText(geometry, axis) {
  const mirrored = geometry.clone();
  const matrix = new THREE.Matrix4();
  const scale = {
    X: new THREE.Vector3(-1, 1, 1),
    Y: new THREE.Vector3(1, -1, 1),
    Z: new THREE.Vector3(1, 1, -1)
  };

  matrix.makeScale(...scale[axis.toUpperCase()].toArray());

  // Split geometry into clusters
  const position = geometry.attributes.position.array;
  const clusterIndices = [];
  const threshold = 3; // Any mesh group smaller than this many faces = potential text
  const visited = new Set();
  const smallClusters = new Set();

  for (let i = 0; i < position.length; i += 9) {
    const indices = [i / 3, i / 3 + 1, i / 3 + 2];
    if (!visited.has(indices[0])) {
      let cluster = [indices[0]];
      visited.add(indices[0]);
      if (cluster.length <= threshold) {
        smallClusters.add(indices[0]);
      }
    }
  }

  const newPos = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 9) {
    const vertexIndex = i / 3;
    if (smallClusters.has(vertexIndex)) {
      newPos.set(position.slice(i, i + 9), i);
    } else {
      const v1 = new THREE.Vector3(position[i], position[i + 1], position[i + 2]);
      const v2 = new THREE.Vector3(position[i + 3], position[i + 4], position[i + 5]);
      const v3 = new THREE.Vector3(position[i + 6], position[i + 7], position[i + 8]);
      v1.applyMatrix4(matrix);
      v2.applyMatrix4(matrix);
      v3.applyMatrix4(matrix);
      newPos.set([...v1.toArray(), ...v2.toArray(), ...v3.toArray()], i);
    }
  }

  mirrored.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  mirrored.computeVertexNormals();
  return { geometry: mirrored, highlight: [...smallClusters] };
}

function App() {
  const [originalGeometry, setOriginalGeometry] = useState(null);
  const [mirroredGeometry, setMirroredGeometry] = useState(null);
  const [highlighted, setHighlighted] = useState([]);
  const fileInput = useRef();
  const loader = new STLLoader();

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const geometry = loader.parse(e.target.result);
      geometry.computeVertexNormals();
      setOriginalGeometry(geometry);
      setMirroredGeometry(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMirror = (axis) => {
    if (!originalGeometry) return;
    const { geometry, highlight } = mirrorGeometryExcludingText(originalGeometry, axis);
    setMirroredGeometry(geometry);
    setHighlighted(highlight);
  };

  const exportSTL = () => {
    const exporter = new THREE.STLExporter();
    const stlString = exporter.parse(new THREE.Mesh(mirroredGeometry));
    const blob = new Blob([stlString], { type: 'text/plain' });
    saveAs(blob, 'mirrored_model.stl');
  };

  return (
    <div className="w-screen h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">MirrorSafe STL</h1>
      <input type="file" accept=".stl" onChange={handleFileUpload} ref={fileInput} className="mb-4" />
      <div className="flex gap-2 mb-4">
        <button onClick={() => handleMirror('X')} className="bg-blue-500 text-white px-4 py-2 rounded">Mirror X</button>
        <button onClick={() => handleMirror('Y')} className="bg-green-500 text-white px-4 py-2 rounded">Mirror Y</button>
        <button onClick={() => handleMirror('Z')} className="bg-red-500 text-white px-4 py-2 rounded">Mirror Z</button>
        {mirroredGeometry && (
          <button onClick={exportSTL} className="bg-gray-700 text-white px-4 py-2 rounded">Export STL</button>
        )}
      </div>
      <div className="w-full h-[500px] bg-white rounded shadow">
        <Canvas camera={{ position: [0, 0, 100] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
          {mirroredGeometry ? (
            <STLViewer geometry={mirroredGeometry} highlightIndices={highlighted} />
          ) : originalGeometry ? (
            <STLViewer geometry={originalGeometry} />
          ) : null}
        </Canvas>
      </div>
    </div>
  );
}

export default App;