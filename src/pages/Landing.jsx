import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Users, Grid2X2, Radio, Flame, ArrowRight } from 'lucide-react'

function useOnScreen(ref, threshold = 0.15) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref, threshold])
  return visible
}

function FadeSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const visible = useOnScreen(ref)
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

export default function Landing() {
  const { session, loading } = useAuth()
  const [heroReady, setHeroReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream text-lg font-body">Loading...</div>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/home" replace />
  }

  const heroWords = ['Stop', 'studying']

  return (
    <div className="min-h-screen bg-navy text-cream overflow-x-hidden">
      {/* ====== ANIMATED GRID BACKGROUND ====== */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(168,255,62,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168,255,62,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            animation: 'gridDrift 20s linear infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes gridDrift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
      `}</style>

      {/* ====== NAVBAR ====== */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5">
        <div className="flex items-center">
          <span className="font-heading text-xl text-cream font-bold">StudyMate</span>
          <span className="w-1.5 h-1.5 bg-accent rounded-full ml-0.5 mb-2" />
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 text-sm font-medium text-cream border border-white/10 hover:border-white/25 transition-colors"
            style={{ borderRadius: '6px' }}
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2.5 text-sm font-bold font-heading bg-accent text-navy hover:bg-accent/90 transition-colors"
            style={{ borderRadius: '6px' }}
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* ====== HERO ====== */}
      <section className="relative z-10 min-h-[calc(100vh-72px)] flex flex-col items-center justify-center text-center px-6">
        {/* Eyebrow */}
        <p
          className="text-xs sm:text-sm tracking-[0.25em] uppercase text-muted mb-6"
          style={{
            opacity: heroReady ? 1 : 0,
            transition: 'opacity 0.6s ease 0.1s',
          }}
        >
          For students who study online
        </p>

        {/* Headline */}
        <h1 className="font-heading font-extrabold leading-[1.05] mb-6" style={{ fontSize: 'clamp(40px, 8vw, 80px)' }}>
          {heroWords.map((word, i) => (
            <span
              key={i}
              className="inline-block mr-[0.3em]"
              style={{
                opacity: heroReady ? 1 : 0,
                transform: heroReady ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.6s ease ${0.2 + i * 0.12}s, transform 0.6s ease ${0.2 + i * 0.12}s`,
              }}
            >
              {word}
            </span>
          ))}
          <br />
          <span
            className="text-accent inline-block"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s',
            }}
          >
            alone.
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="text-muted max-w-[480px] text-base sm:text-lg leading-relaxed mb-10"
          style={{
            opacity: heroReady ? 1 : 0,
            transition: 'opacity 0.7s ease 0.7s',
          }}
        >
          Find students who share your exact subjects.<br />
          Study together in real-time.<br />
          Never feel left out of the digital classroom again.
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4 items-center"
          style={{
            opacity: heroReady ? 1 : 0,
            transform: heroReady ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.6s ease 0.9s, transform 0.6s ease 0.9s',
          }}
        >
          <Link
            to="/signup"
            className="px-8 py-4 text-base font-bold font-heading bg-accent text-navy hover:bg-accent/90 transition-colors flex items-center gap-2"
            style={{ borderRadius: '6px' }}
          >
            Find Your Study Mate <ArrowRight size={18} />
          </Link>
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 text-base font-medium text-cream border border-white/10 hover:border-white/25 transition-colors"
            style={{ borderRadius: '6px' }}
          >
            See how it works
          </button>
        </div>

        {/* Fade gradient at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-navy to-transparent pointer-events-none" />
      </section>

      {/* ====== SOCIAL PROOF ====== */}
      <section className="relative z-10 py-10" style={{ backgroundColor: '#0D1323' }}>
        <div className="text-center">
          <p className="text-muted text-sm mb-4 tracking-wide">Joined by students from</p>
          <p className="text-cream/40 text-sm sm:text-base font-medium tracking-wide">
            IIT Delhi · Stanford · MIT · Oxford · Coursera Learners · Self-taught Devs
            <span className="text-cream/25 ml-1">and more</span>
          </p>
        </div>
      </section>

      {/* ====== PROBLEM ====== */}
      <section className="relative z-10 py-20 sm:py-28 px-6 sm:px-10 lg:px-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeSection>
            <p className="text-accent text-xs tracking-[0.3em] uppercase font-bold mb-4">The Problem</p>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl mb-8 leading-tight">
              Online learning<br />is lonely.
            </h2>
            <div className="space-y-4 text-muted text-base sm:text-lg leading-relaxed">
              <p><span className="text-cream/30 mr-3">—</span>You study the same subjects but can't find each other</p>
              <p><span className="text-cream/30 mr-3">—</span>Discord servers are chaotic and off-topic</p>
              <p><span className="text-cream/30 mr-3">—</span>Study groups die because nobody stays accountable</p>
            </div>
          </FadeSection>

          <FadeSection delay={0.15} className="flex justify-center">
            {/* Disconnected avatars visual */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80">
              {[
                { x: '15%', y: '10%', init: 'A', color: '#F87171', animDelay: '0s' },
                { x: '60%', y: '5%', init: 'K', color: '#60A5FA', animDelay: '0.5s' },
                { x: '10%', y: '60%', init: 'R', color: '#FBBF24', animDelay: '1s' },
                { x: '55%', y: '55%', init: 'M', color: '#A78BFA', animDelay: '1.5s' },
                { x: '38%', y: '35%', init: '?', color: '#6B7A9E', animDelay: '2s' },
              ].map((a, i) => (
                <div
                  key={i}
                  className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-heading font-bold text-lg border-2"
                  style={{
                    left: a.x,
                    top: a.y,
                    backgroundColor: a.color + '15',
                    borderColor: a.color + '30',
                    color: a.color,
                    animation: `float${i} 4s ease-in-out infinite`,
                    animationDelay: a.animDelay,
                  }}
                >
                  {a.init}
                </div>
              ))}
              {/* Dashed lines between some avatars */}
              <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.1 }}>
                <line x1="30%" y1="22%" x2="68%" y2="18%" stroke="#F0EDE6" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="22%" y1="72%" x2="63%" y2="68%" stroke="#F0EDE6" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="25%" y1="25%" x2="20%" y2="65%" stroke="#F0EDE6" strokeWidth="1" strokeDasharray="6 6" />
              </svg>
            </div>
            <style>{`
              @keyframes float0 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(5px,-8px)} }
              @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-7px,6px)} }
              @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(8px,5px)} }
              @keyframes float3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-5px,-7px)} }
              @keyframes float4 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(4px,6px)} }
            `}</style>
          </FadeSection>
        </div>
      </section>

      {/* ====== SOLUTION / FEATURES ====== */}
      <section id="features" className="relative z-10 py-20 sm:py-28 px-6 sm:px-10 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-accent text-xs tracking-[0.3em] uppercase font-bold mb-4">The Solution</p>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-tight">
              Your subject. Your people.<br />Your pace.
            </h2>
          </FadeSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Match by subject', text: 'Post what you\'re studying. Get matched with students on the same path.', delay: 0 },
              { icon: Grid2X2, title: 'Study rooms, always open', text: 'Jump into live rooms by subject. Chat, share resources, stay focused together.', delay: 0.1 },
              { icon: Radio, title: 'Go live with your crew', text: 'Broadcast your study session. Friends join with cam and mic. Like a study cafe, online.', delay: 0.2 },
            ].map(({ icon: Icon, title, text, delay }, i) => (
              <FadeSection key={i} delay={delay}>
                <div
                  className="group p-8 h-full transition-colors duration-300 hover:border-accent/40"
                  style={{
                    backgroundColor: '#131929',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                  }}
                >
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-5">
                    <Icon size={22} className="text-accent" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-cream mb-3">{title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{text}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="relative z-10 py-20 sm:py-28 px-6 sm:px-10 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-20">
            <p className="text-accent text-xs tracking-[0.3em] uppercase font-bold mb-4">How It Works</p>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-tight">
              Three steps to your<br />study crew
            </h2>
          </FadeSection>

          <div className="space-y-20 sm:space-y-28">
            {[
              { num: '01', title: 'Create your profile', text: 'Tell us what you study. Takes 2 minutes.', align: 'left' },
              { num: '02', title: 'Find your mate', text: 'Browse students with matching subjects. Send a short note. Connect when they accept.', align: 'right' },
              { num: '03', title: 'Study together', text: 'Join rooms, hop on sessions, build your streak. Don\'t study alone.', align: 'left' },
            ].map((step, i) => (
              <FadeSection key={i} delay={0.1}>
                <div className={`flex flex-col sm:flex-row items-start gap-6 sm:gap-10 ${step.align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
                  <div className="shrink-0">
                    <StepNumber num={step.num} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-xl sm:text-2xl text-cream mb-3">{step.title}</h3>
                    <p className="text-muted text-base sm:text-lg leading-relaxed max-w-md">{step.text}</p>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ====== STREAK / HABIT ====== */}
      <section className="relative z-10 py-20 sm:py-28 px-6" style={{ backgroundColor: '#0D1323' }}>
        <FadeSection className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl mb-6 leading-tight">
            Build the habit.<br />Track your streak.
          </h2>

          {/* Static streak mockup */}
          <div className="inline-block my-10">
            <div
              className="px-8 py-6"
              style={{ backgroundColor: '#131929', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}
            >
              <div className="flex items-center justify-center gap-3 mb-5">
                <Flame size={24} className="text-accent" />
                <span className="font-heading font-bold text-2xl text-cream">14 day streak</span>
              </div>
              <div className="flex gap-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center text-xs font-bold ${
                        i < 6 ? 'bg-accent/20 text-accent' : 'bg-white/[0.04] text-muted'
                      }`}
                    >
                      {i < 6 ? '✓' : ''}
                    </div>
                    <span className="text-muted text-xs">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-muted text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            Every day you study with StudyMate extends your streak. Your crew keeps you accountable.
          </p>
        </FadeSection>
      </section>

      {/* ====== CTA ====== */}
      <section className="relative z-10 py-24 sm:py-32 px-6 text-center">
        <FadeSection>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl mb-5 leading-tight">
            Ready to find your<br />study crew?
          </h2>
          <p className="text-muted text-base sm:text-lg mb-10">
            Free to join. No chaos. Just focused students.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-10 py-5 text-lg font-bold font-heading bg-accent text-navy hover:bg-accent/90 transition-colors"
            style={{ borderRadius: '6px' }}
          >
            Get Started Free <ArrowRight size={20} />
          </Link>
          <p className="text-muted/50 text-xs mt-5">No credit card. No spam.</p>
        </FadeSection>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <span className="font-heading text-sm text-cream font-bold">StudyMate</span>
            <span className="w-1 h-1 bg-accent rounded-full ml-0.5 mb-1" />
          </div>
          <div className="flex gap-6 text-sm text-muted">
            <a href="#" className="hover:text-cream transition-colors">About</a>
            <a href="#" className="hover:text-cream transition-colors">Privacy</a>
            <a href="#" className="hover:text-cream transition-colors">Contact</a>
          </div>
          <p className="text-muted/50 text-xs">Made for students</p>
        </div>
      </footer>
    </div>
  )
}

function StepNumber({ num }) {
  const ref = useRef(null)
  const visible = useOnScreen(ref, 0.3)
  const [count, setCount] = useState(0)
  const target = parseInt(num)

  useEffect(() => {
    if (!visible) return
    let current = 0
    const interval = setInterval(() => {
      current++
      setCount(current)
      if (current >= target) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [visible, target])

  return (
    <span
      ref={ref}
      className="font-heading font-extrabold text-accent/20 select-none"
      style={{ fontSize: 'clamp(60px, 10vw, 100px)', lineHeight: 1 }}
    >
      {String(count).padStart(2, '0')}
    </span>
  )
}
