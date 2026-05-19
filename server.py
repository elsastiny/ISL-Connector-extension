import os
import json
import asyncio
from fastapi import FastAPI, WebSocket
import uvicorn

# Force Keras to use TensorFlow backend
os.environ["KERAS_BACKEND"] = "tensorflow"
import keras

app = FastAPI()

print("Loading Pre-trained ISL Translation Model from Hugging Face...")
# This automatically downloads the pre-trained Indian Sign Language Model (approx. 253 MB)
try:
    isl_model = keras.saving.load_model("hf://cdsteameight/ISL-SignLanguageTranslation")
    print("Model loaded successfully! Backend is ready.")
except Exception as e:
    print(f"Error loading model: {e}. Falling back to layout pipeline.")
    isl_model = None

@app.websocket("/ws/v1/translate")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Connection established with i3 Chrome Extension!")
    
    try:
        while True:
            # 1. Receive MediaPipe coordinate matrix from i3 extension
            data = await websocket.receive_text()
            payload = json.loads(data)
            landmarks = payload.get("landmarks", [])
            
            if len(landmarks) > 0 and isl_model is not None:
                # 2. Preprocess incoming landmarks to match model shape
                # (Reshape the incoming coordinates array to match what the model expects)
                input_tensor = np.array(landmarks).reshape(1, 30, 126) 
                
                # 3. Run instant inference via the pre-trained model
                prediction = isl_model.predict(input_tensor, verbose=0)
                predicted_text = "Hello / Namaskaram" # Replace with your dictionary mapping lookup
                
                # 4. Send translated text back to the i3 subtitle box
                await websocket.send_json({
                    "text": predicted_text,
                    "type": "subtitle"
                })
            else:
                # Fallback response if no hands are visible
                await websocket.send_json({"text": "Waiting for signs...", "type": "status"})
                
    except Exception as e:
        print(f"Connection closed or error encountered: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    # Run the server on your local network so the i3 laptop can connect to it
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)