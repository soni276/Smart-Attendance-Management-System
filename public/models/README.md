# Face Recognition Models

Download the following model files from the [face-api.js weights repository](https://github.com/justadudewhohacks/face-api.js/tree/master/weights) and place them in this folder (`/public/models/`).

## Required files

### SSD MobileNet V1 (face detection)

- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1` (and any additional shard files referenced in the manifest)

### 68-point face landmarks

- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1` (and any additional shard files)

### Face recognition (128-D descriptors)

- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1` (and any additional shard files)

## Quick download

From the project root:

```bash
# Example using curl (adjust URLs if the repo structure changes)
BASE=https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights
mkdir -p public/models
cd public/models
curl -LO "$BASE/ssd_mobilenetv1_model-weights_manifest.json"
curl -LO "$BASE/ssd_mobilenetv1_model-shard1"
curl -LO "$BASE/face_landmark_68_model-weights_manifest.json"
curl -LO "$BASE/face_landmark_68_model-shard1"
curl -LO "$BASE/face_recognition_model-weights_manifest.json"
curl -LO "$BASE/face_recognition_model-shard1"
```

After downloading, restart the dev server. The Face Scanner will load models from `/models` on first use.
