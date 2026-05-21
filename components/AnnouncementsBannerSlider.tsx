import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import type { Announcement } from '../types';

type Props = {
  announcements: Announcement[];
  autoPlayMs?: number;
  emptyTitle?: string;
};

export const AnnouncementsBannerSlider: React.FC<Props> = ({
  announcements,
  autoPlayMs = 6500,
  emptyTitle = 'No announcements yet',
}) => {
  const safe = useMemo(() => announcements ?? [], [announcements]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (safe.length <= 1) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % safe.length);
    }, autoPlayMs);
    return () => window.clearInterval(t);
  }, [safe.length, autoPlayMs]);

  useEffect(() => {
    if (active > safe.length - 1) setActive(0);
  }, [active, safe.length]);

  if (safe.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <div className="mx-auto inline-flex rounded-2xl bg-primary-50 p-3 text-primary-700">
          <Megaphone size={20} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-gray-900">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-gray-500">Published notices will appear here for the current audience.</p>
      </div>
    );
  }

  const current = safe[active];

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
              <Megaphone size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary-700">Announcements</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 truncate">{current.title}</h2>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
            <p className="text-sm leading-6 text-gray-600">{current.message}</p>
            <div className="sm:text-right">
              <span className="inline-flex rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                {current.targetAudience}
              </span>
              <div className="mt-2 text-xs font-medium text-gray-500">
                {new Date(current.createdAt).toLocaleDateString()} • {new Date(current.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-2xl bg-gray-50 p-3 text-gray-700 transition hover:bg-gray-100"
            onClick={() => setActive((i) => (i - 1 + safe.length) % safe.length)}
            aria-label="Previous announcement"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="rounded-2xl bg-gray-50 p-3 text-gray-700 transition hover:bg-gray-100"
            onClick={() => setActive((i) => (i + 1) % safe.length)}
            aria-label="Next announcement"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {safe.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(idx)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                idx === active ? 'bg-primary-600' : 'bg-[#2E1065]/20 hover:bg-[#2E1065]/30'
              }`}
              aria-label={`Go to announcement ${idx + 1}`}
            />
          ))}
        </div>
        <div className="text-xs font-medium text-gray-500">
          {active + 1} / {safe.length}
        </div>
      </div>
    </div>
  );
};

