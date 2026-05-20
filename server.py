import os
import json
import asyncio
import numpy as np  # <-- Added missing numpy import
from fastapi import FastAPI, WebSocket
import uvicorn

# Force Keras to use TensorFlow backend
os.environ["KERAS_BACKEND"] = "tensorflow"
import keras

app = FastAPI()

# Global buffer to hold sequential frames from the incoming extension stream
sequence_buffer = []

print("Loading Custom Trained ISL Translation Model...")
try:
    # STEP 4: Load your custom model and corresponding string dictionary actions
    isl_model = keras.saving.load_model("isl_model.h5")
    actions = np.load("labels.npy", allow_pickle=True)
    print(f"Model loaded successfully! Detected Classes: {actions}")
except Exception as e:
    print(f"Error loading model: {e}. Falling back to layout pipeline.")
    isl_model = None
    actions = []

@app.websocket("/ws/v1/translate")
async def websocket_endpoint(websocket: WebSocket):
    global sequence_buffer
    await websocket.accept()
    print("Connection established with i3 Chrome Extension!")
    
    try:
        while True:
            # 1. Receive MediaPipe coordinate matrix from i3 extension
            data = await websocket.receive_text()
            payload = json.loads(data)
            landmarks = payload.get("landmarks", [])
            
            if len(landmarks) > 0 and isl_model is not None:
                # Add current frame's landmarks to our queue buffer
                sequence_buffer.append(landmarks)
                # Keep only the last 30 frames for the sequence window
                sequence_buffer = sequence_buffer[-30:]
                
                # 2. Check if we have gathered a full sequence of 30 frames
                if len(sequence_buffer) == 30:
                    # Preprocess incoming matrix to match model input shape: (1, 30, 126)
                    input_tensor = np.array(sequence_buffer).reshape(1, 30, 126) 
                    
                    # 3. Run instant inference via your local custom model
                    prediction = isl_model.predict(input_tensor, verbose=0)[0]
                    
                    # Extract index of the highest probability
                    predicted_idx = np.argmax(prediction)
                    confidence = prediction[predicted_idx]
                    
                    # Implement a confidence threshold (e.g., 80%) to stop errant flickering subtitles
                    if confidence > 0.80:
                        predicted_text = actions[predicted_idx]
                    else:
                        predicted_text = "Analyzing gesture..."
                    
                    # 4. Send translated text back to the i3 subtitle box
                    await websocket.send_json({
                        "text": str(predicted_text),
                        "type": "subtitle"
                    })
                else:
                    # Gathering frames step state
                    await websocket.send_json({
                        "text": f"Calibrating motion... ({len(sequence_buffer)}/30)", 
                        "type": "status"
                    })
            else:
                # Fallback response if no hands are visible
                await websocket.send_json({"text": "Waiting for signs...", "type": "status"})
                
    except Exception as e:
        print(f"Connection closed or error encountered: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    # Run the server locally on port 8000
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)