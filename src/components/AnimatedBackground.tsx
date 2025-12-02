import { useCallback, useEffect, useState } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';

export function AnimatedBackground() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Get initial theme
    const initialTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setTheme(initialTheme || 'dark');

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

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  // Configuration matching WRLD.tech exactly
  const particlesOptions: ISourceOptions = {
    fullScreen: {
      enable: true,
      zIndex: 0,
    },
    background: {
      color: {
        value: 'transparent',
      },
    },
    fpsLimit: 120,
    particles: {
      number: {
        value: theme === 'dark' ? 80 : 60, // Much more particles for visibility
        density: {
          enable: true,
          width: 800,
          height: 800,
        },
      },
      color: {
        value: theme === 'dark' ? '#0ea5e9' : '#1e1e1e', // Cyan for dark, dark gray for light
      },
      shape: {
        type: 'circle',
      },
      opacity: {
        value: theme === 'dark' ? 1 : 0.8, // Maximum opacity for visibility
        random: true,
        animation: {
          enable: true,
          speed: 0.6,
          minimumValue: theme === 'dark' ? 0.5 : 0.4, // Higher minimum
          sync: false,
        },
      },
      size: {
        value: { min: 2, max: 4 }, // Larger particles (was 1-3, now 2-4)
        random: true,
        animation: {
          enable: false,
        },
      },
      links: {
        enable: true,
        distance: 150,
        color: theme === 'dark' ? '#0ea5e9' : '#00adee', // Cyan lines
        opacity: theme === 'dark' ? 0.8 : 0.6, // Much more visible
        width: 1.5, // Thicker lines
      },
      move: {
        enable: true,
        speed: 1,
        direction: 'top',
        random: true,
        straight: false,
        outModes: {
          default: 'out',
          top: 'out',
          bottom: 'in',
        },
        attract: {
          enable: true,
          rotateX: 600,
          rotateY: 1200,
        },
      },
    },
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: {
          enable: true,
          mode: 'grab',
        },
        onClick: {
          enable: true,
          mode: 'push',
        },
        resize: {
          enable: true,
        },
      },
      modes: {
        grab: {
          distance: 250, // Larger grab distance
          links: {
            opacity: theme === 'dark' ? 1 : 0.8, // Maximum opacity on grab
            color: theme === 'dark' ? '#38bdf8' : '#0ea5e9', // Brighter on hover
          },
        },
        push: {
          quantity: 6, // More particles on click
        },
        repulse: {
          distance: 200,
          duration: 0.4,
        },
      },
    },
    detectRetina: true,
  };

  return (
    <>
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={particlesOptions}
        className="particles-container"
      />
      <style>{`
        .particles-container {
          position: fixed !important;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        #tsparticles {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        /* Ensure canvas is properly sized */
        #tsparticles canvas {
          position: fixed !important;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </>
  );
}
