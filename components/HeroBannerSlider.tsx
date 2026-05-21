import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: 'primary' | 'emerald' | 'indigo' | 'amber';
};

type Props = {
  slides: HeroSlide[];
  autoPlayMs?: number;
  onViewDetails?: (slide: HeroSlide) => void;
};

const toneClass = (tone: HeroSlide['tone']) => {
  switch (tone) {
    case 'emerald':
      return {
        ring: 'ring-emerald-300/30',
        bg: 'from-emerald-700/30 via-emerald-600/20 to-slate-900/30',
        accent: 'text-emerald-200',
        pill: 'border-emerald-200/20 bg-emerald-50/10 text-emerald-100',
      };
    case 'indigo':
      return {
        ring: 'ring-indigo-300/30',
        bg: 'from-indigo-700/30 via-indigo-600/20 to-slate-900/30',
        accent: 'text-indigo-200',
        pill: 'border-indigo-200/20 bg-indigo-50/10 text-indigo-100',
      };
    case 'amber':
      return {
        ring: 'ring-amber-300/30',
        bg: 'from-amber-700/30 via-amber-600/20 to-slate-900/30',
        accent: 'text-amber-200',
        pill: 'border-amber-200/20 bg-amber-50/10 text-amber-100',
      };
    case 'primary':
    default:
      return {
        ring: 'ring-primary-300/30',
        bg: 'from-primary-700/30 via-primary-600/20 to-slate-900/30',
        accent: 'text-primary-200',
        pill: 'border-primary-200/20 bg-primary-50/10 text-primary-100',
      };
  }
};

export const HeroBannerSlider: React.FC<Props> = ({ slides, autoPlayMs = 5500, onViewDetails }) => {
  const safeSlides = useMemo(() => (slides.length ? slides : []), [slides]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (safeSlides.length <= 1) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % safeSlides.length);
    }, autoPlayMs);
    return () => window.clearInterval(t);
  }, [safeSlides.length, autoPlayMs]);

  useEffect(() => {
    if (active > safeSlides.length - 1) setActive(0);
  }, [active, safeSlides.length]);

  if (safeSlides.length === 0) return null;

  const current = safeSlides[active];
  const classes = toneClass(current.tone);

  const backgroundForSlide = (slide: HeroSlide) => {
    // Unique per slide without relying on external assets.
    switch (slide.id) {
      case 'attendance':
        return (
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(600px circle at 20% 10%, rgba(52,211,153,0.28), transparent 55%), radial-gradient(520px circle at 80% 25%, rgba(37,99,235,0.16), transparent 55%), radial-gradient(520px circle at 60% 90%, rgba(99,102,241,0.10), transparent 60%)',
            }}
          />
        );
      case 'best-subject':
        return (
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(600px circle at 70% 20%, rgba(99,102,241,0.26), transparent 55%), radial-gradient(520px circle at 20% 40%, rgba(37,99,235,0.14), transparent 55%), radial-gradient(520px circle at 60% 90%, rgba(52,211,153,0.08), transparent 60%)',
            }}
          />
        );
      case 'announcements':
      default:
        return <div className={`absolute inset-0 bg-gradient-to-br ${classes.bg}`} />;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-[28px] ring-1 ${classes.ring}`}>
      {backgroundForSlide(current)}
      <div className="relative px-6 py-7 lg:px-8">

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${classes.pill}`}>
                {current.eyebrow}
              </span>
              <span className={`hidden rounded-full border px-3 py-1 text-primary-100/90 md:inline-flex ${classes.pill}`}>
                Rotating dashboard banner
              </span>
            </div>

            <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${classes.accent}`}>
              {current.title}
            </h2>
            <p className="text-sm leading-6 text-white/80 sm:text-base">{current.subtitle}</p>

            {onViewDetails && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => onViewDetails(current)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  View details
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              {safeSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(idx)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    idx === active ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-2xl bg-white/10 p-3 text-white transition hover:bg-white/15"
              onClick={() => setActive((i) => (i - 1 + safeSlides.length) % safeSlides.length)}
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="rounded-2xl bg-white/10 p-3 text-white transition hover:bg-white/15"
              onClick={() => setActive((i) => (i + 1) % safeSlides.length)}
              aria-label="Next slide"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

