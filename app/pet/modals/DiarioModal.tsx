'use client';

import React, { useState, useTransition, useMemo } from 'react';
import {
  mergeDiaryTimeline,
  computeVirtualMilestones,
  type DiaryEntry,
  type TimelineEntry,
  type VirtualDiaryEntry,
} from '@/lib/diary';
import { LIFE_STAGE_DAYS, type PetRow } from '@/lib/pet-engine';
import { addDiaryNote } from '@/app/pet/diary/actions';
import { ModalWrapper } from './ModalWrapper';

export interface DiarioModalProps {
  pet?: PetRow;
  petName?: string;
  timeline?: TimelineEntry[];
  realEntries?: DiaryEntry[];
  virtualEntries?: VirtualDiaryEntry[];
  onClose?: () => void;
  onAddNote?: (formData: FormData) => Promise<{ error?: string | null } | void> | void;
  className?: string;
}

type AnyEntry = DiaryEntry | VirtualDiaryEntry;

function labelFor(petName: string, entry: AnyEntry): string {
  switch (entry.entry_type) {
    case 'hatched':
      return `${petName} salió del huevo 🐣`;
    case 'grew_up':
      return `${petName} creció y ya es adulto 🌟`;
    case 'got_sick':
      return `${petName} se enfermó 🤒`;
    case 'recovered':
      return `${petName} se recuperó 💊✨`;
    case 'note':
      return `Un recuerdo de ${petName} 📝`;
    default:
      return `Recuerdo de ${petName} ✨`;
  }
}

function imageFor(pet?: PetRow, entry?: AnyEntry): string | null {
  if (!pet || !entry) return null;
  const hatchedAtMs = new Date(pet.created_at).getTime() + LIFE_STAGE_DAYS.egg * 24 * 60 * 60 * 1000;
  const entryIsPreHatch = new Date(entry.occurred_at).getTime() < hatchedAtMs;

  switch (entry.entry_type) {
    case 'hatched':
      return '/egg-sprite.svg';
    case 'grew_up':
      return pet.sprites?.happy || '/egg-sprite.svg';
    default:
      if (entryIsPreHatch) return '/egg-sprite.svg';
      const mood = 'mood_snapshot' in entry ? entry.mood_snapshot : 'happy';
      return pet.sprites?.[mood] || null;
  }
}

function iconForEntryType(entryType: string): string {
  switch (entryType) {
    case 'hatched':
      return '🐣';
    case 'grew_up':
      return '🌟';
    case 'got_sick':
      return '🤒';
    case 'recovered':
      return '💊';
    case 'note':
    default:
      return '📝';
  }
}

function formatEntryTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function DiarioModal({
  pet,
  petName: customPetName,
  timeline: providedTimeline,
  realEntries = [],
  virtualEntries = [],
  onClose = () => {},
  onAddNote,
  className = '',
}: DiarioModalProps) {
  const displayName = customPetName || pet?.name || 'Mi Mascota';

  const [noteText, setNoteText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute combined timeline if not directly provided
  const timeline = useMemo<TimelineEntry[]>(() => {
    if (providedTimeline) return providedTimeline;
    let computedVirtual = virtualEntries;
    if (pet && virtualEntries.length === 0) {
      computedVirtual = computeVirtualMilestones(pet, new Date());
    }
    return mergeDiaryTimeline(realEntries, computedVirtual);
  }, [providedTimeline, realEntries, virtualEntries, pet]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('text', noteText.trim());

    startTransition(async () => {
      try {
        if (onAddNote) {
          const res = await onAddNote(formData);
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            setError(res.error);
            return;
          }
        } else {
          const res = await addDiaryNote({ error: null }, formData);
          if (res?.error) {
            setError(res.error);
            return;
          }
        }
        setNoteText('');
        setSuccessMsg('¡Recuerdo guardado con éxito! 📝✨');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al guardar el recuerdo';
        setError(message);
      }
    });
  };

  return (
    <ModalWrapper
      title={`Diario de ${displayName}`}
      icon="📔"
      onClose={onClose}
      maxWidth="max-w-lg"
      className={className}
      data-testid="diario-modal"
    >
      <div className="space-y-4">
        {/* Add Note Section */}
        <form
          onSubmit={handleSubmit}
          data-testid="diario-add-note-form"
          className="rounded-2xl border-2 border-[#C89B6C]/60 bg-[#FFFDF8] p-3 sm:p-4 space-y-2.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(88,51,26,0.06)]"
        >
          <label htmlFor="diario-note-input" className="block text-xs sm:text-sm font-bold text-[#8B5E3C]">
            Sumar un recuerdo nuevo
          </label>
          <textarea
            id="diario-note-input"
            name="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Escribí algo lindo que quieras recordar..."
            className="w-full rounded-xl border-2 border-[#C89B6C] bg-white px-3 py-2 text-xs sm:text-sm text-[#4A3222] focus:border-[#FF6FA5] focus:outline-none resize-none placeholder:text-[#B39374]"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#8B5E3C]">
              {noteText.length}/280
            </span>
            <button
              type="submit"
              disabled={isPending || !noteText.trim()}
              data-testid="diario-submit-btn"
              className="px-4 py-1.5 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FF9EC4] via-[#FF75A9] to-[#EC4899] text-white text-xs font-bold shadow-[0_2px_0_#58331A] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPending ? 'Guardando...' : 'Guardar recuerdo'}
            </button>
          </div>

          {successMsg && (
            <p role="status" className="text-xs font-bold text-[#15803D] text-center pt-1 animate-pet-pop">
              {successMsg}
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs font-bold text-[#B91C1C] text-center pt-1 animate-pet-pop">
              {error}
            </p>
          )}
        </form>

        {/* Timeline List Section */}
        <div data-testid="diario-timeline-list" className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C] px-1">
            Línea de tiempo de recuerdos
          </h3>

          {timeline.length === 0 ? (
            <div
              data-testid="diario-empty-state"
              className="rounded-2xl border-2 border-dashed border-[#C89B6C]/60 bg-[#FFFDF8]/60 p-6 text-center"
            >
              <span className="text-3xl filter drop-shadow-sm block mb-1">📖</span>
              <p className="text-xs sm:text-sm font-semibold text-[#8B5E3C]">
                Todavía no hay recuerdos. ¡Escribí el primero!
              </p>
            </div>
          ) : (
            timeline.map((item) => {
              const entryKey =
                item.kind === 'real'
                  ? item.entry.id
                  : `virtual-${item.entry.entry_type}-${item.entry.occurred_at}`;
              const spriteSrc = imageFor(pet, item.entry);
              const entryIcon = iconForEntryType(item.entry.entry_type);

              return (
                <div
                  key={entryKey}
                  data-testid={`diario-entry-${item.kind}`}
                  className="flex gap-2.5 sm:gap-3 rounded-2xl border-2 border-[#C89B6C]/60 bg-[#FFFDF8] p-3 shadow-[0_2px_4px_rgba(88,51,26,0.06)]"
                >
                  {/* Sprite or Icon Avatar */}
                  <div className="shrink-0">
                    {spriteSrc ? (
                      <img
                        src={spriteSrc}
                        alt=""
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-[#C89B6C] object-cover bg-[#FFF3C4]/40"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-[#C89B6C] bg-gradient-to-b from-[#FFFDF8] to-[#FFF3C4] flex items-center justify-center text-xl sm:text-2xl">
                        {entryIcon}
                      </div>
                    )}
                  </div>

                  {/* Entry Content */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm text-[#4A3222]">
                      {labelFor(displayName, item.entry)}
                    </p>
                    <p className="text-[11px] font-semibold text-[#8B5E3C]">
                      {formatEntryTime(item.entry.occurred_at)}
                    </p>
                    {item.kind === 'real' &&
                      item.entry.entry_type === 'note' &&
                      item.entry.text && (
                        <div className="mt-1 rounded-xl bg-[#FFF3C4]/50 border border-[#C89B6C]/30 p-2 text-xs text-[#4A3222] font-medium italic">
                          &ldquo;{item.entry.text}&rdquo;
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
