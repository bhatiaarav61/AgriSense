'use client';

// On-device model management page.
import { ModelManager } from '@/components/ModelManager';

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Your models</h1>
        <p className="text-sm text-muted">
          Upload a TensorFlow.js image-classification model to run diagnosis fully on-device — offline, private, and free.
          Models are stored in your browser and never uploaded to any server.
        </p>
      </header>
      <ModelManager />
      <div className="card p-4 text-sm text-muted">
        <p className="mb-1 font-medium text-fg">No model? No problem.</p>
        Detection still works using free AI vision (add a key in Settings for best accuracy) or a fully offline demo
        heuristic. A good starting point is any PlantVillage-trained MobileNet exported for TensorFlow.js — labels like
        <code> Tomato___Late_blight</code> are auto-matched to this region&apos;s diseases.
      </div>
    </div>
  );
}
