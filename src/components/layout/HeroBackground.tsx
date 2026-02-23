'use client';

export function HeroBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Dynamic colorful blobs based on brand colors */}
            <div className="absolute top-0 right-0 -mr-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#FF6B00]/40 to-[#FF6B00]/10 blur-[80px] animate-pulse-slow mix-blend-multiply dark:mix-blend-lighten"></div>
            <div className="absolute bottom-0 left-0 -ml-[10%] -mb-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-[#002B40]/40 to-[#002B40]/10 blur-[100px] animate-pulse-slow mix-blend-multiply dark:mix-blend-lighten" style={{ animationDelay: '2s' }}></div>

            {/* Floating Sports Elements - Beach Tennis & Volei de Areia */}
            <div className="absolute inset-0 w-full h-full opacity-60 dark:opacity-80">

                {/* Beach Tennis Racket (Custom SVG) */}
                <div className="absolute top-[15%] left-[5%] sm:left-[10%] floating-element" style={{ animationDelay: '0s' }}>
                    <svg width="180" height="180" viewBox="0 0 200 200" fill="none" className="text-[#FF6B00] stroke-current">
                        {/* Racket Head */}
                        <path strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.4" d="M100 20 C140 20, 160 50, 150 100 C140 150, 60 150, 50 100 C40 50, 60 20, 100 20 Z" />
                        {/* Racket Handle */}
                        <line x1="100" y1="140" x2="100" y2="190" strokeWidth="16" strokeLinecap="round" className="text-[#002B40] stroke-current dark:text-white" />
                        <line x1="100" y1="140" x2="100" y2="190" strokeWidth="4" strokeLinecap="round" className="text-white stroke-current dark:text-[#FF6B00]" strokeDasharray="4 4" />
                        {/* Racket Holes */}
                        <circle cx="100" cy="80" r="5" fill="white" />
                        <circle cx="80" cy="70" r="5" fill="white" />
                        <circle cx="120" cy="70" r="5" fill="white" />
                        <circle cx="85" cy="100" r="5" fill="white" />
                        <circle cx="115" cy="100" r="5" fill="white" />
                        <circle cx="100" cy="110" r="5" fill="white" />
                    </svg>
                </div>

                {/* Volleyballs */}
                <div className="absolute top-[35%] right-[5%] sm:right-[15%] floating-element" style={{ animationDelay: '1.5s' }}>
                    <svg width="150" height="150" viewBox="0 0 24 24" fill="none" className="text-[#002B40] stroke-current dark:text-[#2dafff]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.3" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20" />
                        <path d="M2 12h20" />
                        <path d="M12 2a14.5 14.5 0 0 1 0 20" />
                        <path d="M12 2c-3.5 0-6 4-6 10s2.5 10 6 10" />
                        <path d="M12 2c3.5 0 6 4 6 10s-2.5 10-6 10" />
                    </svg>
                </div>

                {/* Secondary racket/paddle */}
                <div className="absolute bottom-[20%] right-[20%] sm:right-[30%] scale-100 blur-[1px] floating-element" style={{ animationDelay: '3s', transform: 'rotate(45deg)' }}>
                    <svg width="140" height="140" viewBox="0 0 200 200" fill="none" className="text-[#FF6B00]/80 stroke-current">
                        <path strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.4" d="M100 20 C140 20, 160 50, 150 100 C140 150, 60 150, 50 100 C40 50, 60 20, 100 20 Z" />
                        <line x1="100" y1="140" x2="100" y2="190" strokeWidth="16" strokeLinecap="round" className="text-[#002B40] stroke-current dark:text-white" />
                        <circle cx="100" cy="80" r="5" fill="white" />
                        <circle cx="100" cy="110" r="5" fill="white" />
                    </svg>
                </div>

                {/* Sand Waves / Lines */}
                <div className="absolute bottom-[10%] left-[10%] sm:left-[20%] floating-element" style={{ animationDelay: '2s' }}>
                    <svg width="250" height="80" viewBox="0 0 100 24" fill="none" className="text-[#FF6B00]/60 stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M0 12 C 20 0, 30 24, 50 12 C 70 0, 80 24, 100 12" />
                        <path d="M10 18 C 30 6, 40 30, 60 18 C 80 6, 90 30, 110 18" />
                    </svg>
                </div>

                {/* Tennis balls or smaller elements */}
                <div className="absolute top-[60%] left-[8%] scale-75 floating-element" style={{ animationDelay: '4s' }}>
                    <div className="w-24 h-24 rounded-full border-[6px] bg-[#002B40]/20 border-[#002B40] dark:border-[#2dafff] shadow-[inset_0_0_15px_rgba(0,43,64,0.4)]"></div>
                    <svg className="absolute inset-0 w-full h-full text-[#002B40] dark:text-[#2dafff] opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 2a14.5 14.5 0 0 0 0 20" />
                        <path d="M17 2a14.5 14.5 0 0 1 0 20" />
                    </svg>
                </div>
            </div>

            <div className="absolute inset-0 bg-background/50 z-10" />

            <style>{`
        @keyframes float-complex {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          33% { transform: translate(25px, -35px) rotate(10deg); }
          66% { transform: translate(-20px, 25px) rotate(-8deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        .floating-element {
          animation: float-complex 12s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes pulse-slow-bg {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow-bg 8s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
}
