'use client';

import { useState } from 'react';
import LolekChat from '@/components/LolekChat';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { CanvasRenderer } from '@/components/CanvasRenderer';

export type Artifact = {
  id: string;
  type: 'markdown' | 'code' | 'table';
  title: string;
  content: string;
  isVisible: boolean;
};

export default function HomePage() {
  const [artifact, setArtifact] = useState<Artifact | null>(null);

  const handleArtifactGenerated = (newArtifact: Omit<Artifact, 'id' | 'isVisible'>) => {
    setArtifact({ ...newArtifact, id: crypto.randomUUID(), isVisible: true });
  };

  return (
    <main className="h-screen bg-gray-100">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={35} minSize={25}>
          <LolekChat
            onArtifactGenerated={handleArtifactGenerated}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={30}>
          <CanvasRenderer artifact={artifact} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
