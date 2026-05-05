import { useState, useEffect } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(timer);
  }, [count]);

  const getColor = () => {
    if (count > 0) return '#00f0ff';
    if (count < 0) return '#ff00aa';
    return '#a855f7';
  };

  const color = getColor();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black flex items-center justify-center font-mono">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

        body { font-family: 'Orbitron', monospace; margin: 0; }

        @keyframes flicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
            text-shadow:
              0 0 4px #fff,
              0 0 11px #fff,
              0 0 19px #fff,
              0 0 40px ${color},
              0 0 80px ${color},
              0 0 90px ${color},
              0 0 100px ${color},
              0 0 150px ${color};
            opacity: 1;
          }
          20%, 24%, 55% {
            text-shadow: none;
            opacity: 0.85;
          }
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes gridmove {
          0% { transform: translateY(0); }
          100% { transform: translateY(40px); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .neon-text {
          color: #fff;
          animation: flicker 3s infinite alternate;
        }

        .neon-btn {
          position: relative;
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .neon-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }

        .neon-btn:hover::before {
          transform: translateX(100%);
        }

        .neon-btn:hover {
          transform: translateY(-3px) scale(1.05);
        }

        .neon-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(168, 85, 247, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.15) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: gridmove 3s linear infinite;
        }

        .particle {
          position: absolute;
          border-radius: 50%;
          filter: blur(1px);
          animation: float 6s ease-in-out infinite;
        }

        .pulse-active {
          animation: pulse-ring 0.6s ease-out;
        }
      `}</style>

      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-40"></div>

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}22 0%, transparent 60%)`,
        }}
      ></div>

      {/* Floating particles */}
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            background: i % 2 === 0 ? '#00f0ff' : '#ff00aa',
            boxShadow: `0 0 10px ${i % 2 === 0 ? '#00f0ff' : '#ff00aa'}`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${Math.random() * 4 + 4}s`,
          }}
        ></div>
      ))}

      {/* Rotating glow rings */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${color}, transparent)`,
          animation: 'spin-slow 8s linear infinite',
          filter: 'blur(40px)',
        }}
      ></div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-12 px-8">
        <h1
          className="text-sm md:text-base tracking-[0.4em] uppercase text-gray-400"
          style={{ fontFamily: 'Orbitron, monospace' }}
        >
          ⚡ Neon Counter ⚡
        </h1>

        {/* Counter display */}
        <div className="relative">
          {pulse && (
            <div
              className="absolute inset-0 rounded-full pulse-active"
              style={{
                background: `radial-gradient(circle, ${color}66, transparent)`,
              }}
            ></div>
          )}
          <div
            className="relative px-16 py-8 rounded-3xl border-2 backdrop-blur-sm"
            style={{
              borderColor: color,
              boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}44, 0 0 60px ${color}88`,
              background: 'rgba(0,0,0,0.6)',
              transition: 'all 0.5s ease',
            }}
          >
            <div
              className="neon-text text-9xl md:text-[12rem] font-black tabular-nums"
              style={{
                fontFamily: 'Orbitron, monospace',
                minWidth: '4ch',
                textAlign: 'center',
              }}
            >
              {count}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-6 justify-center">
          <button
            onClick={() => setCount(count - 1)}
            className="neon-btn px-8 py-4 rounded-xl border-2 border-pink-500 text-pink-400 font-bold tracking-widest uppercase text-sm"
            style={{
              boxShadow: '0 0 15px #ff00aa, inset 0 0 15px rgba(255,0,170,0.2)',
              textShadow: '0 0 10px #ff00aa',
              background: 'rgba(255,0,170,0.05)',
            }}
          >
            − Decrease
          </button>

          <button
            onClick={() => setCount(0)}
            className="neon-btn px-8 py-4 rounded-xl border-2 border-purple-500 text-purple-300 font-bold tracking-widest uppercase text-sm"
            style={{
              boxShadow: '0 0 15px #a855f7, inset 0 0 15px rgba(168,85,247,0.2)',
              textShadow: '0 0 10px #a855f7',
              background: 'rgba(168,85,247,0.05)',
            }}
          >
            ↺ Reset
          </button>

          <button
            onClick={() => setCount(count + 1)}
            className="neon-btn px-8 py-4 rounded-xl border-2 font-bold tracking-widest uppercase text-sm"
            style={{
              borderColor: '#00f0ff',
              color: '#00f0ff',
              boxShadow: '0 0 15px #00f0ff, inset 0 0 15px rgba(0,240,255,0.2)',
              textShadow: '0 0 10px #00f0ff',
              background: 'rgba(0,240,255,0.05)',
            }}
          >
            + Increase
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3 text-xs tracking-[0.3em] uppercase text-gray-500">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 10px ${color}`,
            }}
          ></span>
          <span>System Online · Status: {count > 0 ? 'Positive' : count < 0 ? 'Negative' : 'Neutral'}</span>
        </div>
      </div>
    </div>
  );
}
