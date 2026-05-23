// panel.js
let handLandmarker;
let videoElement = document.getElementById('camera-view');
let statusBox = document.getElementById('status-msg');
let subtitleBox = document.getElementById('subtitle-output');
let socket;
let isLoopRunning = false;

// 1. Boot up the independent webcam hardware stream
async function setupLocalCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, frameRate: 30 } 
    });
    videoElement.srcObject = stream;
    statusBox.innerText = "Camera linked! Compiling local MediaPipe engine...";
    initMediaPipe();
  } catch (err) {
    statusBox.innerText = "Hardware Block: Enable extension webcam privacy controls.";
    console.error(err);
  }
}

// 2. Initialize MediaPipe tracking natively inside the extension runtime
async function initMediaPipe() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    
    // Configured with complexity 0 to minimize overhead on your i3 processing chip
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
      },
      runningMode: "VIDEO",
      numHands: 2,
      modelComplexity: 0 
    });
    
    statusBox.innerText = "MediaPipe engine compiled. Linking to backend server...";
    connectToBackend();
  } catch (err) {
    statusBox.innerText = "Failed loading AI framework asset layers.";
    console.error(err);
  }
}

// 3. Connect directly to your i5 Laptop Node Server IP address
function connectToBackend() {
  // Points directly to your i5 laptop's FastAPI backend server
  socket = new WebSocket("ws://192.168.0.61:8000/ws/v1/translate");
  
  socket.onopen = () => {
    statusBox.innerText = "System ready! Click button to begin signing.";
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "subtitle") {
        subtitleBox.innerText = data.text;
      } else if (data.type === "status") {
        statusBox.innerText = data.text;
      }
    } catch (e) {
      console.warn("Payload parse skip:", e);
    }
  };

  socket.onclose = () => {
    statusBox.innerText = "Server connection drop. Reconnecting...";
    setTimeout(connectToBackend, 3000);
  };
}

// 4. Capture frames and send extracted coordinates to the server
let lastVideoTime = -1;
function runCaptureLoop() {
  if (!isLoopRunning) return;

  if (videoElement.currentTime !== lastVideoTime) {
    lastVideoTime = videoElement.currentTime;
    
    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(videoElement, startTimeMs);
    
    // If a hand gesture is seen, pack coordinates and send them down the socket channel
    if (results.landmarks && results.landmarks.length > 0) {
      const coords = results.landmarks[0]; 
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ landmarks: coords }));
      }
    }
  }
  requestAnimationFrame(runCaptureLoop);
}

// Button click to handle translation state toggles
document.getElementById('startPipelineBtn').addEventListener('click', (e) => {
  if (!isLoopRunning) {
    isLoopRunning = true;
    e.target.innerText = "Pause Translation Loop";
    e.target.style.background = "#c0392b";
    statusBox.innerText = "Processing gestures... Sign clearly within frame.";
    runCaptureLoop();
  } else {
    isLoopRunning = false;
    e.target.innerText = "Start Translation Loop";
    e.target.style.background = "#27ae60";
    statusBox.innerText = "Pipeline paused.";
  }
});

// Run camera sequence immediately on load
setupLocalCamera();