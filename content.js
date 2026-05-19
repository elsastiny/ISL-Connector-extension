// 1. Inject the subtitle box UI layer
const style = document.createElement('style');
style.innerHTML = `
  #isl-subtitle-box {
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85); color: #f1c40f; font-size: 32px;
    font-weight: bold; padding: 15px 30px; border-radius: 10px; z-index: 2147483647;
  }
`;
document.head.appendChild(style);

const subtitleBox = document.createElement('div');
subtitleBox.id = 'isl-subtitle-box';
subtitleBox.innerText = "ISL-Connect: Loading Sandbox...";
document.body.appendChild(subtitleBox);

// 2. Create and append the invisible sandbox frame
const iframe = document.createElement('iframe');
iframe.src = chrome.runtime.getURL('sandbox.html');
iframe.style.display = 'none';
document.body.appendChild(iframe);

let trackerReady = false;
let frameCounter = 0;

// 3. Listen for incoming coordinate data from the sandbox environment
window.addEventListener("message", (event) => {
  if (event.data.type === "TRACKER_READY") {
    trackerReady = true;
    subtitleBox.innerText = "ISL-Connect: Tracking Active!";
    console.log("%c SUCCESS: Sandbox Tracker Connected! ", "background: #2ecc71; color: #fff; font-size: 14px;");
    startFrameCaptureLoop();
  }
  
  if (event.data.type === "COORDINATES") {
    const coords = event.data.data;
    console.log(
      `%c SANDBOX DATA -> X: ${coords.x.toFixed(2)} | Y: ${coords.y.toFixed(2)} | Z: ${coords.z.toFixed(2)}`, 
      "color: #3498db; font-weight: bold;"
    );
  }
});

// 4. Capture Google Meet frames and extract raw transferrable pixel buffers
function startFrameCaptureLoop() {
  const videoElement = document.querySelector('video');
  
  if (videoElement && videoElement.readyState >= 2 && trackerReady) {
    frameCounter++;
    
    // Process every 3rd frame to optimize performance on your i3 processor
    if (frameCounter % 3 === 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        // Draw the current video frame safely
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Convert the structural image data data array into an explicit transferrable ArrayBuffer
        const buffer = imgData.data.buffer;
        
        iframe.contentWindow.postMessage({
          type: "PROCESS_FRAME",
          width: canvas.width,
          height: canvas.height,
          buffer: buffer
        }, "*", [buffer]); // Passing the buffer array directly avoids serialization lag
        
      } catch (err) {
        console.warn("Frame extraction skipped due to canvas sync: ", err.message);
      }
    }
  }
  requestAnimationFrame(startFrameCaptureLoop);
}