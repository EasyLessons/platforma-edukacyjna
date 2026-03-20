import { useRef, useEffect, RefObject } from 'react';

interface UseDragScrollOptions {
  autoScrollSpeed?: number;
}

interface UseDragScrollReturn {
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function useDragScroll({ autoScrollSpeed = 0.25 }: UseDragScrollOptions = {}): UseDragScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let animationFrameId: number;
    let scrollPosition = 0;
    let isDragging = false;
    let startX = 0;
    let dragDelta = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;

    const getMaxScroll = () => container.scrollWidth / 2;

    const animate = () => {
      if (!isDragging) {
        if (Math.abs(velocity) > 0.1) {
          scrollPosition += velocity;
          velocity *= 0.92;
        } else {
          velocity = 0;
          scrollPosition += autoScrollSpeed;
        }

        const maxScroll = getMaxScroll();
        if (scrollPosition >= maxScroll) scrollPosition = 0;
        if (scrollPosition < 0) scrollPosition = maxScroll;

        container.style.transform = `translateX(-${scrollPosition}px) translateZ(0)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      dragDelta = 0;
      velocity = 0;
      lastX = e.clientX;
      lastTime = performance.now();
      container.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const now = performance.now();
      const dt = now - lastTime;
      const dx = e.clientX - lastX;

      if (dt > 0) {
        velocity = -dx / dt * 8;
      }

      lastX = e.clientX;
      lastTime = now;

      dragDelta = startX - e.clientX;
      scrollPosition += dragDelta * 0.012;
      startX = e.clientX;

      const maxScroll = getMaxScroll();
      if (scrollPosition >= maxScroll) scrollPosition = 0;
      if (scrollPosition < 0) scrollPosition = maxScroll;

      container.style.transform = `translateX(-${scrollPosition}px) translateZ(0)`;
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    const onTouchStart = (e: TouchEvent) => {
      isDragging = true;
      startX = e.touches[0].clientX;
      dragDelta = 0;
      velocity = 0;
      lastX = e.touches[0].clientX;
      lastTime = performance.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const now = performance.now();
      const dt = now - lastTime;
      const dx = e.touches[0].clientX - lastX;

      if (dt > 0) {
        velocity = -dx / dt * 8;
      }

      lastX = e.touches[0].clientX;
      lastTime = now;

      dragDelta = startX - e.touches[0].clientX;
      scrollPosition += dragDelta * 0.012;
      startX = e.touches[0].clientX;

      const maxScroll = getMaxScroll();
      if (scrollPosition >= maxScroll) scrollPosition = 0;
      if (scrollPosition < 0) scrollPosition = maxScroll;

      container.style.transform = `translateX(-${scrollPosition}px) translateZ(0)`;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    container.style.cursor = 'grab';
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [autoScrollSpeed]);

  return { scrollRef };
}