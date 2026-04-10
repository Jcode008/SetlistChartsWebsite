"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Data types ──────────────────────────────────────────────
export type NoteDuration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type Clef = "treble" | "bass";
export type Accidental = "sharp" | "flat" | "natural" | null;

export interface StaffNote {
  id: string;
  /** Beat position (0-based, fractional) across the entire staff */
  beat: number;
  /** MIDI-style pitch number: C4 = 60, D4 = 62, etc. */
  pitch: number;
  duration: NoteDuration;
  accidental: Accidental;
  /** If true, render as rest at that beat */
  isRest?: boolean;
}

export interface StaffData {
  clef: Clef;
  bars: number;
  timeSignature: [number, number]; // [beats, beatValue]
  notes: StaffNote[];
}

interface StaffNotationProps {
  data: StaffData;
  onChange: (data: StaffData) => void;
}

// ── Constants ───────────────────────────────────────────────
const LINE_SPACING = 10; // pixels between staff lines
const STAFF_LINES = 5;
const STAFF_HEIGHT = LINE_SPACING * (STAFF_LINES - 1); // 40px
const TOP_MARGIN = 50; // space above staff for ledger lines / notes
const BOTTOM_MARGIN = 50;
const LEFT_MARGIN = 60; // space for clef
const RIGHT_MARGIN = 20;
const BEAT_WIDTH = 40; // pixels per beat
const NOTE_RADIUS = 5;
const SVG_HEIGHT = TOP_MARGIN + STAFF_HEIGHT + BOTTOM_MARGIN;

const DURATIONS: { value: NoteDuration; label: string; icon: string; beats: number }[] = [
  { value: "whole", label: "Whole", icon: "𝅝", beats: 4 },
  { value: "half", label: "Half", icon: "𝅗𝅥", beats: 2 },
  { value: "quarter", label: "Quarter", icon: "♩", beats: 1 },
  { value: "eighth", label: "Eighth", icon: "♪", beats: 0.5 },
  { value: "sixteenth", label: "16th", icon: "𝅘𝅥𝅯", beats: 0.25 },
];

// Pitch mapping - staff positions relative to middle line (B4 for treble, D3 for bass)
// Position 0 = middle line, positive = up, negative = down. Each step = half a LINE_SPACING.
// Treble clef: middle line = B4 (MIDI 71). Lines bottom→top: E4, G4, B4, D5, F5
// Bass clef: middle line = D3 (MIDI 50). Lines bottom→top: G2, B2, D3, F3, A3

// Treble: bottom line (E4=64), space (F4=65), line (G4=67), space (A4=69), line (B4=71), space (C5=72), line (D5=74), space (E5=76), top line (F5=77)
// We map staff position (0=bottom line) to pitch. Each position = one step in the scale.

// Natural pitches in order (C, D, E, F, G, A, B)
const NATURAL_PITCHES = [0, 2, 4, 5, 7, 9, 11]; // semitone offsets within an octave

function midiToStaffPosition(midi: number, clef: Clef): number {
  // Convert MIDI note to a "staff position" where 0 = bottom staff line
  // Each staff position is a line or space (diatonic step)
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;

  // Map to diatonic position (ignoring sharps/flats, use nearest natural)
  const diatonicInOctave = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0, D=1, E=2, F=3, G=4, A=5, B=6
  const diatonic = octave * 7 + diatonicInOctave[semitone];

  if (clef === "treble") {
    // Bottom line = E4 = octave 4, diatonic 2 (E) → diatonic position = 4*7+2 = 30
    const bottomLineDiatonic = 4 * 7 + 2; // E4
    return diatonic - bottomLineDiatonic;
  } else {
    // Bass: bottom line = G2 = octave 2, diatonic 4 (G) → 2*7+4 = 18
    const bottomLineDiatonic = 2 * 7 + 4; // G2
    return diatonic - bottomLineDiatonic;
  }
}

function staffPositionToMidi(position: number, clef: Clef): number {
  // Convert staff position back to MIDI pitch (natural notes only)
  let diatonic: number;

  if (clef === "treble") {
    const bottomLineDiatonic = 4 * 7 + 2; // E4
    diatonic = position + bottomLineDiatonic;
  } else {
    const bottomLineDiatonic = 2 * 7 + 4; // G2
    diatonic = position + bottomLineDiatonic;
  }

  const octave = Math.floor(diatonic / 7);
  const step = ((diatonic % 7) + 7) % 7; // 0=C, 1=D, 2=E, 3=F, 4=G, 5=A, 6=B
  const semitoneMap = [0, 2, 4, 5, 7, 9, 11];
  return (octave + 1) * 12 + semitoneMap[step];
}

function staffPositionToY(position: number): number {
  // Position 0 = bottom line. Each position is half a LINE_SPACING.
  // Y increases downward, so higher position = lower Y.
  const bottomLineY = TOP_MARGIN + STAFF_HEIGHT;
  return bottomLineY - position * (LINE_SPACING / 2);
}

function yToStaffPosition(y: number): number {
  const bottomLineY = TOP_MARGIN + STAFF_HEIGHT;
  return Math.round((bottomLineY - y) / (LINE_SPACING / 2));
}

function durationToBeats(d: NoteDuration): number {
  return DURATIONS.find((dur) => dur.value === d)?.beats ?? 1;
}

let nextId = 1;
function genId(): string {
  return `n${Date.now()}_${nextId++}`;
}

function isNatural(midi: number): boolean {
  const semitone = midi % 12;
  return [0, 2, 4, 5, 7, 9, 11].includes(semitone);
}

function getNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

// ── Component ───────────────────────────────────────────────
export default function StaffNotation({ data, onChange }: StaffNotationProps) {
  const [selectedDuration, setSelectedDuration] = useState<NoteDuration>("quarter");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; position: number; beat: number } | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const totalBeats = data.bars * data.timeSignature[0];
  const svgWidth = LEFT_MARGIN + totalBeats * BEAT_WIDTH + RIGHT_MARGIN;

  // Snap x coordinate to nearest beat grid
  function xToBeat(x: number): number {
    const raw = (x - LEFT_MARGIN) / BEAT_WIDTH;
    // Snap to 0.25 beat grid (sixteenth note resolution)
    return Math.max(0, Math.min(totalBeats - 0.25, Math.round(raw * 4) / 4));
  }

  function beatToX(beat: number): number {
    return LEFT_MARGIN + beat * BEAT_WIDTH;
  }

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isDragging) {
        // Move the dragged note
        const beat = xToBeat(x);
        const position = yToStaffPosition(y);
        const pitch = staffPositionToMidi(position, data.clef);

        onChange({
          ...data,
          notes: data.notes.map((n) =>
            n.id === isDragging ? { ...n, beat, pitch } : n
          ),
        });
        return;
      }

      // Show ghost note
      if (x >= LEFT_MARGIN && x <= svgWidth - RIGHT_MARGIN) {
        const beat = xToBeat(x);
        const position = yToStaffPosition(y);
        setGhostPosition({ x: beatToX(beat), y: staffPositionToY(position), position, beat });
      } else {
        setGhostPosition(null);
      }
    },
    [isDragging, data, svgWidth, onChange]
  );

  const handleSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < LEFT_MARGIN || x > svgWidth - RIGHT_MARGIN) return;

      const beat = xToBeat(x);
      const position = yToStaffPosition(y);
      const pitch = staffPositionToMidi(position, data.clef);

      // Check if clicking an existing note
      const clickedNote = data.notes.find((n) => {
        const npos = midiToStaffPosition(n.pitch, data.clef);
        const nx = beatToX(n.beat);
        const ny = staffPositionToY(npos);
        return Math.abs(nx - x) < 12 && Math.abs(ny - y) < 8;
      });

      if (clickedNote) {
        if (selectedNote === clickedNote.id) {
          // Already selected — deselect
          setSelectedNote(null);
        } else {
          // Select and start drag
          setSelectedNote(clickedNote.id);
          setIsDragging(clickedNote.id);
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }
        return;
      }

      // Place a new note
      const newNote: StaffNote = {
        id: genId(),
        beat,
        pitch,
        duration: selectedDuration,
        accidental: null,
      };

      onChange({ ...data, notes: [...data.notes, newNote] });
      setSelectedNote(newNote.id);
    },
    [data, selectedDuration, selectedNote, svgWidth, onChange]
  );

  const handleSvgPointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(null);
    }
  }, [isDragging]);

  function deleteNote(id: string) {
    onChange({ ...data, notes: data.notes.filter((n) => n.id !== id) });
    if (selectedNote === id) setSelectedNote(null);
  }

  function toggleAccidental(id: string) {
    onChange({
      ...data,
      notes: data.notes.map((n) => {
        if (n.id !== id) return n;
        const cycle: Accidental[] = [null, "sharp", "flat", "natural"];
        const idx = cycle.indexOf(n.accidental);
        return { ...n, accidental: cycle[(idx + 1) % cycle.length] };
      }),
    });
  }

  function toggleRest(id: string) {
    onChange({
      ...data,
      notes: data.notes.map((n) =>
        n.id === id ? { ...n, isRest: !n.isRest } : n
      ),
    });
  }

  function changeNoteDuration(id: string, duration: NoteDuration) {
    onChange({
      ...data,
      notes: data.notes.map((n) =>
        n.id === id ? { ...n, duration } : n
      ),
    });
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!selectedNote) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNote(selectedNote);
      }
      if (e.key === "#" || e.key === "s") {
        toggleAccidental(selectedNote);
      }
      if (e.key === "r") {
        toggleRest(selectedNote);
      }
      // Duration shortcuts
      const durationKeys: Record<string, NoteDuration> = {
        "1": "whole", "2": "half", "3": "quarter", "4": "eighth", "5": "sixteenth",
      };
      if (durationKeys[e.key]) {
        changeNoteDuration(selectedNote, durationKeys[e.key]);
        setSelectedDuration(durationKeys[e.key]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // ── Rendering helpers ─────────────────────────────────────
  function renderStaffLines() {
    const lines = [];
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = TOP_MARGIN + i * LINE_SPACING;
      lines.push(
        <line
          key={`line-${i}`}
          x1={LEFT_MARGIN - 5}
          x2={svgWidth - RIGHT_MARGIN}
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth={1}
          className="text-foreground/30"
        />
      );
    }
    return lines;
  }

  function renderBarLines() {
    const lines = [];
    for (let bar = 0; bar <= data.bars; bar++) {
      const x = LEFT_MARGIN + bar * data.timeSignature[0] * BEAT_WIDTH;
      lines.push(
        <line
          key={`bar-${bar}`}
          x1={x}
          x2={x}
          y1={TOP_MARGIN}
          y2={TOP_MARGIN + STAFF_HEIGHT}
          stroke="currentColor"
          strokeWidth={bar === 0 || bar === data.bars ? 2 : 1}
          className="text-foreground/40"
        />
      );
    }
    return lines;
  }

  function renderClef() {
    const clefSymbol = data.clef === "treble" ? "𝄞" : "𝄢";
    const yPos = data.clef === "treble" ? TOP_MARGIN + STAFF_HEIGHT - 5 : TOP_MARGIN + STAFF_HEIGHT - 12;
    return (
      <text
        x={LEFT_MARGIN - 45}
        y={yPos}
        fontSize={data.clef === "treble" ? 42 : 36}
        className="fill-foreground/70 select-none"
      >
        {clefSymbol}
      </text>
    );
  }

  function renderTimeSignature() {
    const x = LEFT_MARGIN - 15;
    return (
      <>
        <text x={x} y={TOP_MARGIN + 15} fontSize={16} fontWeight="bold" textAnchor="middle" className="fill-foreground/60 select-none font-serif">
          {data.timeSignature[0]}
        </text>
        <text x={x} y={TOP_MARGIN + STAFF_HEIGHT - 4} fontSize={16} fontWeight="bold" textAnchor="middle" className="fill-foreground/60 select-none font-serif">
          {data.timeSignature[1]}
        </text>
      </>
    );
  }

  function renderLedgerLines(position: number, x: number) {
    const lines = [];

    // Ledger lines below staff (position < 0)
    if (position < 0) {
      for (let p = -2; p >= position; p -= 2) {
        const y = staffPositionToY(p);
        lines.push(
          <line
            key={`ledger-below-${p}`}
            x1={x - 10}
            x2={x + 10}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-foreground/30"
          />
        );
      }
    }

    // Ledger lines above staff (position > 8, since top line is position 8)
    if (position > 8) {
      for (let p = 10; p <= position; p += 2) {
        const y = staffPositionToY(p);
        lines.push(
          <line
            key={`ledger-above-${p}`}
            x1={x - 10}
            x2={x + 10}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-foreground/30"
          />
        );
      }
    }

    // Middle C ledger line (position = -2 for treble, position = 12 for bass)
    return lines;
  }

  function renderNoteHead(note: StaffNote) {
    const position = midiToStaffPosition(note.pitch, data.clef);
    const x = beatToX(note.beat);
    const y = staffPositionToY(position);
    const isSelected = selectedNote === note.id;

    if (note.isRest) {
      // Render rest symbol
      const restSymbols: Record<NoteDuration, string> = {
        whole: "𝄻", half: "𝄼", quarter: "𝄽", eighth: "𝄾", sixteenth: "𝄿",
      };
      return (
        <g key={note.id}>
          <text
            x={x}
            y={TOP_MARGIN + STAFF_HEIGHT / 2 + 6}
            fontSize={22}
            textAnchor="middle"
            className={`select-none ${isSelected ? "fill-accent" : "fill-foreground/70"}`}
            style={{ cursor: "pointer" }}
          >
            {restSymbols[note.duration]}
          </text>
        </g>
      );
    }

    const filled = note.duration !== "whole" && note.duration !== "half";
    const hasStem = note.duration !== "whole";
    const hasFlag = note.duration === "eighth" || note.duration === "sixteenth";

    // Stem direction: above middle line → stem down, below → stem up
    const stemUp = position < 4;
    const stemLength = 30;

    return (
      <g key={note.id} style={{ cursor: isDragging === note.id ? "grabbing" : "pointer" }}>
        {/* Ledger lines */}
        {renderLedgerLines(position, x)}

        {/* Note head - ellipse */}
        <ellipse
          cx={x}
          cy={y}
          rx={NOTE_RADIUS + 1}
          ry={NOTE_RADIUS}
          fill={filled ? (isSelected ? "var(--accent)" : "currentColor") : "transparent"}
          stroke={isSelected ? "var(--accent)" : "currentColor"}
          strokeWidth={1.5}
          className={!filled && !isSelected ? "text-foreground/80" : isSelected ? "" : "text-foreground/80"}
          transform={`rotate(-10, ${x}, ${y})`}
        />

        {/* Stem */}
        {hasStem && (
          <line
            x1={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS}
            x2={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS}
            y1={y}
            y2={stemUp ? y - stemLength : y + stemLength}
            stroke={isSelected ? "var(--accent)" : "currentColor"}
            strokeWidth={1.5}
            className={isSelected ? "" : "text-foreground/80"}
          />
        )}

        {/* Flags for eighth / sixteenth */}
        {hasFlag && (
          <>
            <path
              d={
                stemUp
                  ? `M ${x + NOTE_RADIUS} ${y - stemLength} Q ${x + NOTE_RADIUS + 12} ${y - stemLength + 10} ${x + NOTE_RADIUS + 2} ${y - stemLength + 18}`
                  : `M ${x - NOTE_RADIUS} ${y + stemLength} Q ${x - NOTE_RADIUS - 12} ${y + stemLength - 10} ${x - NOTE_RADIUS - 2} ${y + stemLength - 18}`
              }
              fill="none"
              stroke={isSelected ? "var(--accent)" : "currentColor"}
              strokeWidth={1.5}
              className={isSelected ? "" : "text-foreground/80"}
            />
            {note.duration === "sixteenth" && (
              <path
                d={
                  stemUp
                    ? `M ${x + NOTE_RADIUS} ${y - stemLength + 6} Q ${x + NOTE_RADIUS + 12} ${y - stemLength + 16} ${x + NOTE_RADIUS + 2} ${y - stemLength + 24}`
                    : `M ${x - NOTE_RADIUS} ${y + stemLength - 6} Q ${x - NOTE_RADIUS - 12} ${y + stemLength - 16} ${x - NOTE_RADIUS - 2} ${y + stemLength - 24}`
                }
                fill="none"
                stroke={isSelected ? "var(--accent)" : "currentColor"}
                strokeWidth={1.5}
                className={isSelected ? "" : "text-foreground/80"}
              />
            )}
          </>
        )}

        {/* Accidental */}
        {note.accidental && (
          <text
            x={x - NOTE_RADIUS - 10}
            y={y + 4}
            fontSize={14}
            className={isSelected ? "fill-accent select-none" : "fill-foreground/70 select-none"}
          >
            {note.accidental === "sharp" ? "♯" : note.accidental === "flat" ? "♭" : "♮"}
          </text>
        )}

        {/* Note name tooltip on hover/select */}
        {isSelected && (
          <text
            x={x}
            y={y < TOP_MARGIN + 15 ? y + NOTE_RADIUS + 14 : y - NOTE_RADIUS - 6}
            fontSize={9}
            textAnchor="middle"
            className="fill-accent/70 select-none"
            fontWeight="bold"
          >
            {getNoteName(note.pitch)}
          </text>
        )}
      </g>
    );
  }

  function renderGhost() {
    if (!ghostPosition || isDragging) return null;
    // Don't show if there's already a note at this exact position
    const existing = data.notes.find((n) => {
      const np = midiToStaffPosition(n.pitch, data.clef);
      return n.beat === ghostPosition.beat && np === ghostPosition.position;
    });
    if (existing) return null;

    return (
      <ellipse
        cx={ghostPosition.x}
        cy={ghostPosition.y}
        rx={NOTE_RADIUS + 1}
        ry={NOTE_RADIUS}
        fill="var(--accent)"
        opacity={0.25}
        transform={`rotate(-10, ${ghostPosition.x}, ${ghostPosition.y})`}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  // Beat grid lines (subtle)
  function renderBeatGrid() {
    const lines = [];
    for (let beat = 0; beat < totalBeats; beat++) {
      const x = beatToX(beat);
      lines.push(
        <line
          key={`beat-${beat}`}
          x1={x}
          x2={x}
          y1={TOP_MARGIN}
          y2={TOP_MARGIN + STAFF_HEIGHT}
          stroke="currentColor"
          strokeWidth={0.5}
          strokeDasharray="2,4"
          className="text-foreground/10"
        />
      );
    }
    return lines;
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/30 flex-wrap">
        {/* Clef selector */}
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => onChange({ ...data, clef: "treble" })}
            className={`px-2 py-0.5 text-sm rounded transition-colors ${
              data.clef === "treble" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Treble Clef"
          >
            𝄞
          </button>
          <button
            onClick={() => onChange({ ...data, clef: "bass" })}
            className={`px-2 py-0.5 text-sm rounded transition-colors ${
              data.clef === "bass" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Bass Clef"
          >
            𝄢
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Duration selector */}
        <div className="flex items-center gap-0.5 mx-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDuration(d.value)}
              className={`px-2 py-0.5 text-sm rounded transition-colors ${
                selectedDuration === d.value
                  ? "bg-accent/20 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={`${d.label} note (${d.beats} beats)`}
            >
              {d.icon}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 mx-2">
          {selectedNote && (
            <>
              <button
                onClick={() => toggleAccidental(selectedNote)}
                className="px-2 py-0.5 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                title="Toggle accidental (♯/♭/♮)"
              >
                ♯/♭
              </button>
              <button
                onClick={() => toggleRest(selectedNote)}
                className="px-2 py-0.5 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                title="Toggle rest"
              >
                𝄽
              </button>
              <button
                onClick={() => deleteNote(selectedNote)}
                className="px-2 py-0.5 text-xs rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                title="Delete note (Del)"
              >
                ✕
              </button>
            </>
          )}
        </div>

        {/* Bars control */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Bars</span>
          <button
            onClick={() => data.bars > 1 && onChange({ ...data, bars: data.bars - 1 })}
            className="w-5 h-5 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            −
          </button>
          <span className="text-xs text-foreground/70 w-4 text-center">{data.bars}</span>
          <button
            onClick={() => onChange({ ...data, bars: data.bars + 1 })}
            className="w-5 h-5 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* SVG Staff */}
      <div className="overflow-x-auto" style={{ touchAction: "pan-y" }}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={SVG_HEIGHT}
          className="select-none"
          style={{ minWidth: svgWidth, touchAction: "none" }}
          onPointerMove={handleSvgPointerMove}
          onPointerDown={handleSvgPointerDown}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={() => { setGhostPosition(null); handleSvgPointerUp(); }}
        >
          {/* Beat grid */}
          {renderBeatGrid()}

          {/* Staff lines */}
          {renderStaffLines()}

          {/* Bar lines */}
          {renderBarLines()}

          {/* Clef */}
          {renderClef()}

          {/* Time signature */}
          {renderTimeSignature()}

          {/* Ghost note */}
          {renderGhost()}

          {/* Notes */}
          {data.notes.map((note) => renderNoteHead(note))}
        </svg>
      </div>

      {/* Hint */}
      <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground/40 tracking-wide">
        Click to place note · Drag to move · Del to delete · # for accidentals · 1-5 for duration
      </div>
    </div>
  );
}
