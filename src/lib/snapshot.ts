type SnapshotRenderer = () => string | null;

let snapshotRenderer: SnapshotRenderer | null = null;

export function registerSnapshotRenderer(renderer: SnapshotRenderer): () => void {
  snapshotRenderer = renderer;
  return () => {
    if (snapshotRenderer === renderer) snapshotRenderer = null;
  };
}

export function captureSceneToPng(): boolean {
  const dataUrl = snapshotRenderer?.();
  if (!dataUrl) return false;

  const anchor = document.createElement('a');
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  anchor.download = `pouwu-${stamp}.png`;
  anchor.href = dataUrl;
  anchor.click();
  return true;
}
