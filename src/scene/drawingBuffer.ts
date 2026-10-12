interface DrawingBufferRenderer {
  setDrawingBufferSize(width: number, height: number, pixelRatio: number): void;
  domElement: { style: { width: string; height: string } };
}

interface DrawingBufferSize { width: number; height: number; pixelRatio: number }
const sizes = new WeakMap<DrawingBufferRenderer, DrawingBufferSize>();

/** Updates the physical buffer once and retains its logical CSS size. */
export function resizeDrawingBuffer(
  renderer: DrawingBufferRenderer,
  width: number,
  height: number,
  pixelRatio: number,
): boolean {
  // A temporarily hidden/unsized host must not destroy the current buffer.
  if (![width, height, pixelRatio].every(value => Number.isFinite(value) && value > 0)) return false;
  const previous = sizes.get(renderer);
  if (previous?.width === width && previous.height === height && previous.pixelRatio === pixelRatio) return false;

  // setPixelRatio() calls setSize() internally in Three; calling both would
  // reset the canvas twice. This API sets dimensions and DPR together.
  renderer.setDrawingBufferSize(width, height, pixelRatio);
  renderer.domElement.style.width = `${width}px`;
  renderer.domElement.style.height = `${height}px`;
  sizes.set(renderer, { width, height, pixelRatio });
  return true;
}
