import { type CSSProperties, type ReactNode, useLayoutEffect, useState } from 'react';

/** 横屏触控设计稿基准宽度 */
export const DESIGN_WIDTH = 1920;
/** 横屏触控设计稿基准高度 */
export const DESIGN_HEIGHT = 1080;

interface DesignCanvasProps {
  /** 画布内的页面内容 */
  children: ReactNode;
}

/**
 * 将固定 1920×1080 设计稿按比例缩放以适应视口，保持 16:9，居中留白（letterbox）。
 * 适用于大屏触控 kiosk。
 */
export function DesignCanvas({ children }: DesignCanvasProps) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    /** 根据窗口尺寸计算缩放比例 */
    const updateScale = () => {
      const sx = window.innerWidth / DESIGN_WIDTH;
      const sy = window.innerHeight / DESIGN_HEIGHT;
      setScale(Math.min(sx, sy));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const outerStyle: CSSProperties = {
    width: DESIGN_WIDTH * scale,
    height: DESIGN_HEIGHT * scale,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const innerStyle: CSSProperties = {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    position: 'absolute',
    left: 0,
    top: 0,
  };

  return (
    <div className="design-canvas-fit">
      <div className="design-canvas-slot" style={outerStyle}>
        <div className="design-canvas-stage" style={innerStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}
