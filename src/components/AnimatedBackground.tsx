import { useEffect, useRef, useState } from 'react';

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      setTheme(currentTheme || 'dark');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let mouse = { x: 0, y: 0 };
    let isMouseMoving = false;
    let mouseTimeout: NodeJS.Timeout;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    // Theme-specific configuration (matching WRLD.tech style)
    const getConfig = () => {
      const isDark = theme === 'dark';
      return {
        particleColor: isDark ? '14, 165, 233' : '30, 30, 30', // Cyan for dark, dark gray for light
        lineColor: isDark ? '14, 165, 233' : '0, 173, 238', // Cyan for both, matches #00adee
        particleCount: 12, // Matches WRLD.tech exactly
        particleOpacity: { min: 0.1, max: 0.6 },
        lineOpacity: 0.42,
        lineWidth: 0.96,
        maxDistance: 142, // Matches WRLD.tech
        speed: 1,
        canvasOpacity: isDark ? 0.6 : 0.3,
      };
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      baseOpacity: number;
      opacityDirection: number;
      opacitySpeed: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        // Move upward (direction: "top") with some randomness
        const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.5; // Mostly upward
        const speed = getConfig().speed;
        this.vx = Math.cos(angle) * speed * (Math.random() * 0.5 + 0.5);
        this.vy = Math.sin(angle) * speed * (Math.random() * 0.5 + 0.5);

        this.size = Math.random() * 1 + 1; // Size 1-2px (random size)
        this.baseOpacity = Math.random() * 0.5 + 0.1;
        this.opacity = this.baseOpacity;
        this.opacityDirection = Math.random() > 0.5 ? 1 : -1;
        this.opacitySpeed = 0.00057; // Matches WRLD.tech animation speed
      }

      update() {
        const config = getConfig();

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Bounce at edges (out_mode: "bounce")
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        // Keep within bounds
        this.x = Math.max(0, Math.min(canvas.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height, this.y));

        // Animate opacity
        this.opacity += this.opacitySpeed * this.opacityDirection;
        if (this.opacity >= config.particleOpacity.max || this.opacity <= config.particleOpacity.min) {
          this.opacityDirection *= -1;
        }

        // Mouse attraction (matches WRLD.tech attract settings)
        if (isMouseMoving) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 200) {
            const force = (200 - distance) / 200;
            this.vx += (dx / distance) * force * 0.02;
            this.vy += (dy / distance) * force * 0.02;

            // Limit velocity
            const maxVel = 3;
            const vel = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (vel > maxVel) {
              this.vx = (this.vx / vel) * maxVel;
              this.vy = (this.vy / vel) * maxVel;
            }
          }
        }
      }

      draw() {
        const config = getConfig();
        ctx.fillStyle = `rgba(${config.particleColor}, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      const config = getConfig();
      const density = config.particleCount / 742; // value_area from WRLD.tech
      const area = (canvas.width * canvas.height) / 10000;
      const count = Math.floor(density * area);

      for (let i = 0; i < Math.max(config.particleCount, count); i++) {
        particles.push(new Particle());
      }
    };

    const connectParticles = (hoverMode = false) => {
      const config = getConfig();
      const maxDistance = hoverMode ? 195 : config.maxDistance; // Grab distance: 194.89
      const lineOpacity = hoverMode ? 0.47 : config.lineOpacity; // Grab opacity: 0.4689

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * lineOpacity;
            ctx.strokeStyle = `rgba(${config.lineColor}, ${opacity})`;
            ctx.lineWidth = config.lineWidth;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Connect particles to mouse on hover
      if (isMouseMoving && hoverMode) {
        particles.forEach(particle => {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * lineOpacity;
            ctx.strokeStyle = `rgba(${config.lineColor}, ${opacity})`;
            ctx.lineWidth = config.lineWidth;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      connectParticles(isMouseMoving);

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      isMouseMoving = true;

      clearTimeout(mouseTimeout);
      mouseTimeout = setTimeout(() => {
        isMouseMoving = false;
      }, 100);
    };

    const handleClick = () => {
      // Push mode: add 4 particles at mouse position (matches WRLD.tech)
      for (let i = 0; i < 4; i++) {
        const particle = new Particle();
        particle.x = mouse.x + (Math.random() - 0.5) * 20;
        particle.y = mouse.y + (Math.random() - 0.5) * 20;
        particles.push(particle);
      }

      // Remove excess particles after a delay
      setTimeout(() => {
        if (particles.length > getConfig().particleCount * 2) {
          particles = particles.slice(0, getConfig().particleCount * 2);
        }
      }, 1000);
    };

    resizeCanvas();
    init();
    animate();

    window.addEventListener('resize', () => {
      resizeCanvas();
      init();
    });

    // Enable pointer events for interactivity
    canvas.style.pointerEvents = 'auto';
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      clearTimeout(mouseTimeout);
    };
  }, [theme]);

  return (
    <>
      <canvas ref={canvasRef} className="animated-background" />
      <style>{`
        .animated-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          opacity: 0.6;
          cursor: pointer;
        }

        [data-theme="light"] .animated-background {
          opacity: 0.3;
        }
      `}</style>
    </>
  );
}
