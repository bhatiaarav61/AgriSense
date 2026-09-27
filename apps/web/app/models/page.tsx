'use client';

// On-device model management page.
import { Cpu } from 'lucide-react';
import { ModelManager } from '@/components/ModelManager';

export default function ModelsPage() {
  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex items-center gap-3">
        <span className="icon-tile"><Cpu className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Your models</h1>
          <p className="text-sm text-muted">
            Run diagnosis fully on-device — offline, private, and free. Models are stored in your browser and never uploaded.
          </p>
        </div>
      </header>
      <ModelManager />
      <div className="card p-4 text-sm text-muted">
        <p className="mb-1 font-semibold text-fg">No model? No problem.</p>
        Detection still works using free AI vision (add a key in Settings for best accuracy) or a fully offline demo
        heuristic. A good starting point is any PlantVillage-trained MobileNet exported for TensorFlow.js — labels like
        <code> Tomato___Late_blight</code> are auto-matched to this region&apos;s diseases.
      </div>
    </div>
  );
}
