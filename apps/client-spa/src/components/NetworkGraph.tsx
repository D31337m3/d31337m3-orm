/**
 * NetworkGraph — Interactive HTML5 Canvas node graph
 * Renders floating data-link nodes that fragment apart on mouse proximity.
 * Used as the hero section background.
 */

import { useEffect, useRef, useCallback } from 'react';

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  opacity: number;
  color: string;
  isDataBroker: boolean;
  fragmenting: boolean;
  fragmentSpeed: number;
}

interface Props {
  className?: string;
}

const COLORS = ['#06B6D4', '#7C3AED', '#10B981', '#06B6D4'];

export default function NetworkGraph({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const nodesRef  = useRef<Node[]>([]);
  const mouseRef  = useRef({ x: -9999, y: -9999 });

  const initNodes = useCallback((w: number, h: number) => {
    nodesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.6 + 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isDataBroker: Math.random() < 0.2,
      fragmenting: false,
      fragmentSpeed: Math.random() * 2 + 1,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initNodes(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', onMouseMove);

    const draw = () => {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      const nodes = nodesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update nodes
      for (const n of nodes) {
        const dx = n.x - mx, dy = n.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          // Fragment: push away from cursor
          n.fragmenting = true;
          n.vx += (dx / dist) * 0.8;
          n.vy += (dy / dist) * 0.8;
          n.opacity = Math.max(0, n.opacity - 0.02);
        } else {
          n.fragmenting = false;
          // Dampen and drift back
          n.vx *= 0.97;
          n.vy *= 0.97;
          n.opacity = Math.min(0.8, n.opacity + 0.005);
        }

        n.x += n.vx;
        n.y += n.vy;

        // Wrap around edges
        if (n.x < 0) n.x = W;
        if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H;
        if (n.y > H) n.y = 0;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 120) continue;

          const alpha = (1 - dist / 120) * 0.15 * Math.min(a.opacity, b.opacity);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);

          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `${a.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
          grad.addColorStop(1, `${b.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

        if (n.isDataBroker) {
          // Data broker nodes: bright red with glow
          ctx.fillStyle = `rgba(239,68,68,${n.opacity})`;
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = `${n.color}${Math.floor(n.opacity * 255).toString(16).padStart(2, '0')}`;
          ctx.shadowColor = n.color;
          ctx.shadowBlur = n.fragmenting ? 0 : 6;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ cursor: 'crosshair' }}
    />
  );
}
