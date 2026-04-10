"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Stroke } from "./DrawingCanvas";
import type { StaffData } from "./StaffNotation";

const DrawingCanvas = dynamic(() => import("./DrawingCanvas"), { ssr: false });
const StaffNotation = dynamic(() => import("./StaffNotation"), { ssr: false });

export interface Chart {
  id: string;
  title: string;
  content: string;
  notes: string;
  drawing_data: string;
  staff_data: string;
  setlist_id: string;
  position: number;
  key_signature: string;
  tempo: number | null;
  time_signature: string;
}

interface ChartEditorProps {
  chart: Chart;
  onUpdate: (chart: Chart) => void;
}

const KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4", "5/4", "7/8", "12/8"];

const SECTIONS = ["Intro", "Verse", "Verse 1", "Verse 2", "Verse 3", "Pre-Chorus", "Chorus", "Bridge", "Solo", "Breakdown", "Interlude", "Outro", "Tag", "Coda", "Instrumental"];

const TAB_TEMPLATES: Record<string, { label: string; strings: string[] }> = {
  guitar: {
    label: "Guitar (6-string)",
    strings: ["e", "B", "G", "D", "A", "E"],
  },
  bass: {
    label: "Bass (4-string)",
    strings: ["G", "D", "A", "E"],
  },
  bass5: {
    label: "Bass (5-string)",
    strings: ["G", "D", "A", "E", "B"],
  },
  ukulele: {
    label: "Ukulele",
    strings: ["A", "E", "C", "G"],
  },
  banjo: {
    label: "Banjo (5-string)",
    strings: ["1", "2", "3", "4", "5"],
  },
};

const CHORD_REGEX = /^[A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[0-9]*|[0-9]+)*(?:\/[A-G][#b]?)?$/;
const CHORD_PATTERN = /\b([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[0-9]*|[0-9]+)?(?:\/[A-G][#b]?)?)\b/g;

const CHORD_WIDTH = 6; // fixed width for each chord cell in auto-format
const TAB_BEAT_WIDTH = 3; // characters per beat position in tab

type ViewMode = "edit" | "preview" | "split";

export default function ChartEditor({ chart, onUpdate }: ChartEditorProps) {
  const [title, setTitle] = useState(chart.title);
  const [content, setContent] = useState(chart.content);
  const [notes, setNotes] = useState(chart.notes || "");
  const [drawingData, setDrawingData] = useState<Stroke[]>(() => {
    try { return chart.drawing_data ? JSON.parse(chart.drawing_data) : []; }
    catch { return []; }
  });
  const [staffDataList, setStaffDataList] = useState<StaffData[]>(() => {
    try { return chart.staff_data ? JSON.parse(chart.staff_data) : []; }
    catch { return []; }
  });
  const [key, setKey] = useState(chart.key_signature);
  const [tempo, setTempo] = useState(chart.tempo?.toString() || "120");
  const [timeSig, setTimeSig] = useState(chart.time_signature);
  const [saved, setSaved] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [showNotes, setShowNotes] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [showStaffMenu, setShowStaffMenu] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showQuickChords, setShowQuickChords] = useState(false);
  const [quickChordInput, setQuickChordInput] = useState("");
  const [tabBars, setTabBars] = useState(4);
  const [staffBars, setStaffBars] = useState(4);
  const quickChordRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const staffMenuRef = useRef<HTMLDivElement>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node)) setShowSectionMenu(false);
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) setShowTabMenu(false);
      if (staffMenuRef.current && !staffMenuRef.current.contains(e.target as Node)) setShowStaffMenu(false);
      if (insertMenuRef.current && !insertMenuRef.current.contains(e.target as Node)) setShowInsertMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset state when chart changes
  useEffect(() => {
    setTitle(chart.title);
    setContent(chart.content);
    setNotes(chart.notes || "");
    try { setStaffDataList(chart.staff_data ? JSON.parse(chart.staff_data) : []); }
    catch { setStaffDataList([]); }
    setKey(chart.key_signature);
    setTempo(chart.tempo?.toString() || "120");
    setTimeSig(chart.time_signature);
    setSaved(true);
  }, [chart.id, chart.title, chart.content, chart.notes, chart.drawing_data, chart.staff_data, chart.key_signature, chart.tempo, chart.time_signature]);

  const debouncedSave = useCallback(
    (updated: Partial<Chart>) => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onUpdate({
          ...chart,
          title,
          content,
          notes,
          drawing_data: JSON.stringify(drawingData),
          staff_data: JSON.stringify(staffDataList),
          key_signature: key,
          tempo: parseInt(tempo) || null,
          time_signature: timeSig,
          ...updated,
        });
        setSaved(true);
      }, 800);
    },
    [chart, title, content, notes, drawingData, staffDataList, key, tempo, timeSig, onUpdate]
  );

  // -- Insert helpers --
  function insertAtCursor(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      const newContent = content + (content && !content.endsWith("\n") ? "\n" : "") + text;
      setContent(newContent);
      debouncedSave({ content: newContent });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const insertion = (needsNewline ? "\n" : "") + text + "\n";
    const newContent = before + insertion + after;
    setContent(newContent);
    debouncedSave({ content: newContent });
    requestAnimationFrame(() => {
      const cursorPos = start + insertion.length;
      textarea.selectionStart = textarea.selectionEnd = cursorPos;
      textarea.focus();
    });
  }

  function insertSection(name: string) {
    insertAtCursor(`[${name}]`);
    setShowSectionMenu(false);
  }

  function insertTabStaff(instrument: string) {
    const template = TAB_TEMPLATES[instrument];
    if (!template) return;
    const barWidth = 12;
    const totalWidth = barWidth * tabBars;
    const lines = template.strings.map(
      (s) => `${s.padStart(2)}|${"-".repeat(totalWidth)}|`
    );
    insertAtCursor(lines.join("\n"));
    setShowTabMenu(false);
  }

  function insertStaff(type: string) {
    const clef = type === "bass_clef" ? "bass" as const : "treble" as const;
    const timeSigParts = timeSig.split("/").map(Number);
    const newStaff: StaffData = {
      clef,
      bars: staffBars,
      timeSignature: [timeSigParts[0] || 4, timeSigParts[1] || 4],
      notes: [],
    };
    const newList = [...staffDataList, newStaff];
    setStaffDataList(newList);
    debouncedSave({ staff_data: JSON.stringify(newList) });
    setShowStaffMenu(false);
  }

  function handleStaffChange(index: number, newData: StaffData) {
    const newList = staffDataList.map((s, i) => (i === index ? newData : s));
    setStaffDataList(newList);
    debouncedSave({ staff_data: JSON.stringify(newList) });
  }

  function removeStaff(index: number) {
    const newList = staffDataList.filter((_, i) => i !== index);
    setStaffDataList(newList);
    debouncedSave({ staff_data: JSON.stringify(newList) });
  }

  function insertChordRow() {
    insertAtCursor("|     |     |     |     |");
    setShowInsertMenu(false);
  }

  function insertRepeat() {
    insertAtCursor("||:     :||");
    setShowInsertMenu(false);
  }

  function insertLyricLine() {
    insertAtCursor("> ");
    setShowInsertMenu(false);
  }

  function insertDivider() {
    insertAtCursor("─────────────────────────────────");
    setShowInsertMenu(false);
  }

  // -- Quick chord entry --
  function handleQuickChordSubmit() {
    const input = quickChordInput.trim();
    if (!input) return;
    // Split by spaces or commas
    const chords = input.split(/[\s,]+/).filter(Boolean);
    if (chords.length === 0) return;
    // Build formatted chord row(s), 4 chords per bar line by default
    const rows: string[] = [];
    for (let i = 0; i < chords.length; i += 4) {
      const batch = chords.slice(i, i + 4);
      const cells = batch.map((c) => ` ${c.padEnd(CHORD_WIDTH - 1)}`);
      rows.push("|" + cells.join("|") + "|");
    }
    insertAtCursor(rows.join("\n"));
    setQuickChordInput("");
    setShowQuickChords(false);
  }

  // -- Auto-format entire content --
  function autoFormatContent() {
    const lines = content.split("\n");
    const formatted: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Format chord rows: | chord | chord | ... |
      if (trimmed.match(/^\|.*\|$/) && !trimmed.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i)) {
        const cells = trimmed.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const formattedCells = cells.map((cell) => {
          const chord = cell.trim();
          if (!chord) return " ".repeat(CHORD_WIDTH);
          return ` ${chord.padEnd(CHORD_WIDTH - 1)}`;
        });
        formatted.push("|" + formattedCells.join("|") + "|");
        i++;
        continue;
      }

      // Format tab blocks: detect and align to consistent width
      const tabMatch = trimmed.match(/^(.{1,2})\|(.+)\|$/);
      if (tabMatch) {
        // Gather all contiguous tab lines
        const tabLines: { label: string; body: string }[] = [];
        while (i < lines.length) {
          const tl = lines[i].trim();
          const tm = tl.match(/^(.{1,2})\|(.+)\|$/);
          if (tm && tm[2].match(/^[\d\-hpbs/\\~x\s]+$/i)) {
            tabLines.push({ label: tm[1], body: tm[2] });
            i++;
          } else {
            break;
          }
        }
        if (tabLines.length > 0) {
          // Find the max body length and normalize
          const maxLen = Math.max(...tabLines.map((t) => t.body.length));
          // Round up to nearest multiple of TAB_BEAT_WIDTH
          const targetLen = Math.ceil(maxLen / TAB_BEAT_WIDTH) * TAB_BEAT_WIDTH;
          const maxLabel = Math.max(...tabLines.map((t) => t.label.length));
          for (const tl of tabLines) {
            const paddedLabel = tl.label.padStart(maxLabel);
            // Extend body with dashes if too short
            const paddedBody = tl.body.length < targetLen
              ? tl.body + "-".repeat(targetLen - tl.body.length)
              : tl.body;
            formatted.push(`${paddedLabel}|${paddedBody}|`);
          }
          continue;
        }
      }

      // Remove excess blank lines (collapse 3+ blank lines to 2)
      if (trimmed === "" && i > 0 && i < lines.length - 1) {
        let blankCount = 0;
        let j = i;
        while (j < lines.length && lines[j].trim() === "") {
          blankCount++;
          j++;
        }
        const keep = Math.min(blankCount, 2);
        for (let k = 0; k < keep; k++) formatted.push("");
        i = j;
        continue;
      }

      formatted.push(line);
      i++;
    }

    const newContent = formatted.join("\n");
    setContent(newContent);
    debouncedSave({ content: newContent });
  }

  // -- Auto-format chord input --
  function handleContentChange(newContent: string) {
    setContent(newContent);
    debouncedSave({ content: newContent });
  }

  function handleSmartInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const textarea = e.target;
    const newValue = textarea.value;
    const cursor = textarea.selectionStart;

    // Detect if space was just typed
    if (newValue.length === content.length + 1 && newValue[cursor - 1] === " ") {
      // Get the current line up to cursor
      const beforeCursor = newValue.substring(0, cursor);
      const lineStart = beforeCursor.lastIndexOf("\n") + 1;
      const currentLine = beforeCursor.substring(lineStart);

      // Check if we're in a chord line (starts with |)
      if (currentLine.startsWith("| ") || currentLine.startsWith("|")) {
        // Get the word before the space
        const trimmedLine = currentLine.trimEnd();
        const lastBarIdx = trimmedLine.lastIndexOf("|");
        const cellContent = trimmedLine.substring(lastBarIdx + 1).trim();

        // Check if what was typed looks like a chord
        if (cellContent && CHORD_REGEX.test(cellContent)) {
          // Pad the chord to fixed width and add bar separator
          const padded = ` ${cellContent.padEnd(CHORD_WIDTH - 1)}|`;
          // Replace from last | to cursor
          const replaceFrom = lineStart + lastBarIdx + 1;
          const formatted = newValue.substring(0, replaceFrom) + padded + newValue.substring(cursor);
          setContent(formatted);
          debouncedSave({ content: formatted });
          requestAnimationFrame(() => {
            // Place cursor after the new | and a space for the next chord
            const newCursorPos = replaceFrom + padded.length;
            textarea.selectionStart = textarea.selectionEnd = newCursorPos;
          });
          return;
        }
      }
    }

    // Detect double-space or space at end after partial chord line (auto-close)
    if (newValue.length === content.length + 1 && newValue[cursor - 1] === " ") {
      const beforeCursor = newValue.substring(0, cursor);
      const lineStart = beforeCursor.lastIndexOf("\n") + 1;
      const currentLine = beforeCursor.substring(lineStart).trimEnd();
      // If line starts with | and ends with | followed by space, the row is done
      // Skip — already handled above
    }

    handleContentChange(newValue);
  }

  function handleNotesChange(newNotes: string) {
    setNotes(newNotes);
    debouncedSave({ notes: newNotes });
  }

  function handleDrawingChange(newStrokes: Stroke[]) {
    setDrawingData(newStrokes);
    debouncedSave({ drawing_data: JSON.stringify(newStrokes) });
  }

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    debouncedSave({ title: newTitle });
  }

  function handleKeyChange(newKey: string) {
    setKey(newKey);
    debouncedSave({ key_signature: newKey });
  }

  function handleTempoChange(newTempo: string) {
    setTempo(newTempo);
    debouncedSave({ tempo: parseInt(newTempo) || null });
  }

  function handleTimeSigChange(newTimeSig: string) {
    setTimeSig(newTimeSig);
    debouncedSave({ time_signature: newTimeSig });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const beforeCursor = content.substring(0, cursor);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const currentLine = beforeCursor.substring(lineStart);
    const lineEnd = content.indexOf("\n", cursor);
    const fullLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

    if (e.key === "Tab") {
      e.preventDefault();

      // In tab lines: jump to next beat position
      const tabLineMatch = fullLine.match(/^(.{1,2})\|/);
      if (tabLineMatch) {
        const bodyStart = lineStart + tabLineMatch[0].length;
        const posInBody = cursor - bodyStart;
        if (posInBody >= 0) {
          // Jump to next multiple of TAB_BEAT_WIDTH
          const nextPos = (Math.floor(posInBody / TAB_BEAT_WIDTH) + 1) * TAB_BEAT_WIDTH;
          const targetCursor = bodyStart + nextPos;
          // Don't go past the closing |
          const closingBar = fullLine.lastIndexOf("|");
          const maxCursor = lineStart + closingBar;
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.min(targetCursor, maxCursor);
          });
          return;
        }
      }

      // Default: insert 4 spaces
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + "    " + content.substring(end);
      setContent(newContent);
      debouncedSave({ content: newContent });
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }

    // Enter key: auto-continue chord rows and tab blocks
    if (e.key === "Enter") {
      const trimmedLine = fullLine.trim();

      // After a chord row, start a new one
      if (trimmedLine.match(/^\|.*\|$/) && !trimmedLine.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i)) {
        e.preventDefault();
        // Count cells in current row
        const cells = trimmedLine.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const emptyCells = cells.map(() => " ".repeat(CHORD_WIDTH));
        const newRow = "\n|" + emptyCells.join("|") + "|";
        const insertPos = lineEnd === -1 ? content.length : lineEnd;
        const newContent = content.substring(0, insertPos) + newRow + content.substring(insertPos);
        setContent(newContent);
        debouncedSave({ content: newContent });
        requestAnimationFrame(() => {
          // Place cursor inside first cell of new row
          textarea.selectionStart = textarea.selectionEnd = insertPos + 2;
        });
        return;
      }

      // After a tab block, offer a new tab block
      if (trimmedLine.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i)) {
        // Check if this is the last line of a tab block
        const nextLineStart = lineEnd === -1 ? content.length : lineEnd + 1;
        const nextLine = content.substring(nextLineStart, content.indexOf("\n", nextLineStart) === -1 ? content.length : content.indexOf("\n", nextLineStart)).trim();
        // Only auto-continue if this is the last string in the tab block
        if (!nextLine.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i)) {
          // Don't auto-continue tab blocks — just let normal enter work
        }
      }
    }

    // Start a new chord bar with | key
    if (e.key === "|") {
      // If line is empty and just typed |, this starts a chord line → add space
      if (currentLine === "") {
        e.preventDefault();
        const newContent = content.substring(0, cursor) + "| " + content.substring(cursor);
        setContent(newContent);
        debouncedSave({ content: newContent });
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = cursor + 2;
        });
      }
    }

    // Ctrl/Cmd + Shift + F: Auto-format
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "f") {
      e.preventDefault();
      autoFormatContent();
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.max(textarea.scrollHeight, 400) + "px";
    }
  }, [content]);

  // -- Preview rendering --
  function renderPreview() {
    if (!content.trim()) {
      return <div className="text-muted-foreground/30 text-sm italic">No content yet. Switch to Edit to start writing.</div>;
    }

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    let currentSection = "";

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Section header
      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];

        elements.push(
          <div key={i} className="mt-6 mb-2 first:mt-0">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
              {sectionMatch[1]}
            </span>
          </div>
        );
        i++;
        continue;
      }

      // Staff notation lines
      const staffMatch = trimmed.match(/^[𝄞𝄢𝄥\s]*[┌╔╠║│╚└┐╗╣┘╝]/);
      if (staffMatch) {
        const staffLines: string[] = [];
        while (i < lines.length) {
          const sl = lines[i].trim();
          if (sl.match(/[┌╔╠║│╚└┐╗╣┘╝═─]/) || sl.match(/^[𝄞𝄢𝄥]/)) {
            staffLines.push(lines[i]);
            i++;
          } else {
            break;
          }
        }
        elements.push(
          <pre key={`staff-${i}`} className="font-mono text-[13px] leading-[1.3] text-foreground/85 rounded-md px-4 py-3 my-2 overflow-x-auto whitespace-pre bg-secondary/40">
            {staffLines.join("\n")}
          </pre>
        );
        continue;
      }

      // Tab lines
      const tabLineMatch = trimmed.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i);
      if (tabLineMatch) {
        const tabLines: string[] = [];
        while (i < lines.length) {
          const tl = lines[i].trim();
          if (tl.match(/^.{1,2}\|[\d\-hpbs/\\~x\s|]+$/i)) {
            tabLines.push(lines[i]);
            i++;
          } else {
            break;
          }
        }
        elements.push(
          <pre key={`tab-${i}`} className="font-mono text-[13px] leading-[1.4] text-foreground/85 rounded-md px-4 py-3 my-2 overflow-x-auto whitespace-pre bg-secondary/40">
            {tabLines.join("\n")}
          </pre>
        );
        continue;
      }

      // Chord row
      const chordRowMatch = trimmed.match(/^\|.*\|$/);
      if (chordRowMatch) {
        elements.push(
          <div key={i} className="font-mono text-sm my-0.5 text-foreground/80">
            {renderChordsInLine(trimmed)}
          </div>
        );
        i++;
        continue;
      }

      // Repeat markers
      if (trimmed.startsWith("||:") || trimmed.endsWith(":||")) {
        elements.push(
          <div key={i} className="font-mono text-sm text-accent/80 font-medium my-0.5">
            {trimmed}
          </div>
        );
        i++;
        continue;
      }

      // Lyric lines
      if (trimmed.startsWith(">")) {
        elements.push(
          <div key={i} className="text-sm italic text-foreground/60 pl-4 my-0.5 border-l-2 border-accent/30">
            {trimmed.substring(1).trim()}
          </div>
        );
        i++;
        continue;
      }

      // Divider lines
      if (trimmed.match(/^[─\-=]{10,}$/)) {
        elements.push(<hr key={i} className="my-4 border-t border-border/60" />);
        i++;
        continue;
      }

      // Empty line
      if (trimmed === "") {
        elements.push(<div key={i} className="h-3" />);
        i++;
        continue;
      }

      // Regular text
      elements.push(
        <div key={i} className="text-sm text-foreground/75 my-0.5 leading-6">
          {renderChordsInLine(trimmed)}
        </div>
      );
      i++;
    }

    return <>{elements}</>;
  }

  function renderChordsInLine(line: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(CHORD_PATTERN.source, "g");

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      parts.push(
        <span key={match.index} className="text-accent font-medium">
          {match[0]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts.length > 0 ? parts : line;
  }

  // -- Icons --
  const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  );

  const PreviewIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const SplitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>
    </svg>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar: title + metadata */}
      <div className="flex items-center gap-5 px-6 py-3 border-b border-border flex-wrap">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-lg font-light tracking-tight bg-transparent border-none focus:outline-none min-w-0 flex-shrink placeholder:text-muted-foreground/40"
          placeholder="Untitled chart"
        />

        <div className="flex items-center gap-5 ml-auto flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Key</label>
            <select
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="px-2 py-1 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] tracking-widest uppercase text-muted-foreground">BPM</label>
            <input
              type="number"
              value={tempo}
              onChange={(e) => handleTempoChange(e.target.value)}
              className="w-14 px-2 py-1 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              min={20}
              max={300}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] tracking-widest uppercase text-muted-foreground">Time</label>
            <select
              value={timeSig}
              onChange={(e) => handleTimeSigChange(e.target.value)}
              className="px-2 py-1 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
            >
              {TIME_SIGNATURES.map((ts) => (
                <option key={ts} value={ts}>{ts}</option>
              ))}
            </select>
          </div>

          <span className={`text-[10px] tracking-wide ${saved ? "text-muted-foreground/60" : "text-accent"}`}>
            {saved ? "Saved" : "Saving..."}
          </span>
        </div>
      </div>

      {/* Insert toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card/30 flex-wrap">
        {/* Section insert */}
        <div className="relative" ref={sectionMenuRef}>
          <button
            onClick={() => { setShowSectionMenu(!showSectionMenu); setShowTabMenu(false); setShowStaffMenu(false); setShowInsertMenu(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showSectionMenu ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h7"/>
            </svg>
            Section
          </button>
          {showSectionMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px] max-h-[280px] overflow-y-auto">
              {SECTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => insertSection(s)}
                  className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  [{s}]
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab staff insert */}
        <div className="relative" ref={tabMenuRef}>
          <button
            onClick={() => { setShowTabMenu(!showTabMenu); setShowSectionMenu(false); setShowStaffMenu(false); setShowInsertMenu(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showTabMenu ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Tab
          </button>
          {showTabMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-2 z-50 min-w-[200px]">
              <div className="px-3 pb-2 mb-1 border-b border-border">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Bars</label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 4, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTabBars(n)}
                      className={`px-2 py-0.5 text-xs rounded ${tabBars === n ? "bg-accent text-primary-foreground" : "bg-foreground/5 text-muted-foreground hover:text-foreground"} transition-colors`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {Object.entries(TAB_TEMPLATES).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => insertTabStaff(key)}
                  className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Staff notation insert */}
        <div className="relative" ref={staffMenuRef}>
          <button
            onClick={() => { setShowStaffMenu(!showStaffMenu); setShowSectionMenu(false); setShowTabMenu(false); setShowInsertMenu(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showStaffMenu ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <span className="text-sm leading-none">𝄞</span>
            Staff
          </button>
          {showStaffMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-2 z-50 min-w-[200px]">
              <div className="px-3 pb-2 mb-1 border-b border-border">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Bars</label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 4, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setStaffBars(n)}
                      className={`px-2 py-0.5 text-xs rounded ${staffBars === n ? "bg-accent text-primary-foreground" : "bg-foreground/5 text-muted-foreground hover:text-foreground"} transition-colors`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => insertStaff("treble")}
                className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <span className="mr-2">𝄞</span>
                Treble Clef
              </button>
              <button
                onClick={() => insertStaff("bass_clef")}
                className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <span className="mr-2">𝄢</span>
                Bass Clef
              </button>
            </div>
          )}
        </div>

        {/* Quick Chord Entry */}
        <div className="relative">
          <button
            onClick={() => { setShowQuickChords(!showQuickChords); setShowSectionMenu(false); setShowTabMenu(false); setShowStaffMenu(false); setShowInsertMenu(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showQuickChords ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Quick
          </button>
          {showQuickChords && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg p-3 z-50 min-w-[300px]">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Type chords separated by spaces</label>
              <div className="flex gap-2">
                <input
                  ref={quickChordRef}
                  type="text"
                  value={quickChordInput}
                  onChange={(e) => setQuickChordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleQuickChordSubmit(); if (e.key === "Escape") setShowQuickChords(false); }}
                  className="flex-1 px-2 py-1 text-xs font-mono rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
                  placeholder="Am F C G"
                  autoFocus
                />
                <button
                  onClick={handleQuickChordSubmit}
                  className="px-2.5 py-1 text-xs rounded-md bg-accent text-primary-foreground hover:bg-accent/80 transition-colors"
                >
                  Insert
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">e.g. Am F C G → | Am    | F     | C     | G     |</p>
            </div>
          )}
        </div>

        {/* Auto Format */}
        <button
          onClick={autoFormatContent}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          title="Auto-format chord rows and tabs (Ctrl+Shift+F)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M4 12h10M4 17h16"/>
          </svg>
          Format
        </button>

        {/* Other inserts */}
        <div className="relative" ref={insertMenuRef}>
          <button
            onClick={() => { setShowInsertMenu(!showInsertMenu); setShowSectionMenu(false); setShowTabMenu(false); setShowStaffMenu(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showInsertMenu ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Insert
          </button>
          {showInsertMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
              <button onClick={insertChordRow} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                Chord Row  <span className="text-[10px] text-muted-foreground/50 ml-1">|   |   |   |</span>
              </button>
              <button onClick={insertRepeat} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                Repeat Markers  <span className="text-[10px] text-muted-foreground/50 ml-1">||:   :||</span>
              </button>
              <button onClick={insertLyricLine} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                Lyric Line  <span className="text-[10px] text-muted-foreground/50 ml-1">&gt;</span>
              </button>
              <button onClick={insertDivider} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                Divider
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* View mode toggles */}
        <div className="flex items-center bg-foreground/[0.03] rounded-md p-0.5">
          <button
            onClick={() => setViewMode("edit")}
            className={`p-1.5 rounded transition-colors duration-200 ${viewMode === "edit" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Edit"
          >
            <EditIcon />
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`p-1.5 rounded transition-colors duration-200 ${viewMode === "split" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Split view"
          >
            <SplitIcon />
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`p-1.5 rounded transition-colors duration-200 ${viewMode === "preview" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Preview"
          >
            <PreviewIcon />
          </button>
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Drawing mode toggle */}
        <button
          onClick={() => { setDrawingMode(!drawingMode); if (!drawingMode && viewMode === "edit") setViewMode("preview"); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${drawingMode ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          title="Draw / Apple Pencil"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          Draw
        </button>

        {/* Notes toggle */}
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-200 ${showNotes ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          title="Notes panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Notes
        </button>
      </div>

      {/* Editor / Preview area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Edit pane */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div className={`overflow-y-auto ${viewMode === "split" ? "w-1/2 border-r border-border" : "flex-1"}`}>
            <div className="max-w-3xl mx-auto px-6 py-6">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleSmartInput}
                onKeyDown={handleKeyDown}
                className="w-full font-mono text-sm leading-7 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-foreground/90 placeholder:text-muted-foreground/30"
                placeholder={`[Intro]\n| C     | Am    | F     | G     |\n\n[Verse 1]\n| Am    | Am    | F     | F     |\n> Lyrics go here...\n\nTips:\n• Type | then a chord + space to auto-format\n• Press Enter on a chord row to add another\n• Use Quick button for fast chord entry\n• Press Format or Ctrl+Shift+F to tidy up\n• Tab key jumps between beat positions in tabs`}
                spellCheck={false}
              />

              {/* Visual staff notation widgets in edit mode */}
              {staffDataList.length > 0 && (
                <div className="mt-4 space-y-2">
                  {staffDataList.map((staffData, idx) => (
                    <div key={idx} className="relative group">
                      <StaffNotation
                        data={staffData}
                        onChange={(newData) => handleStaffChange(idx, newData)}
                      />
                      <button
                        onClick={() => removeStaff(idx)}
                        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-xs text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 active:text-red-300 transition-colors"
                        title="Remove staff"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview pane (with optional drawing overlay) */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`overflow-y-auto relative ${viewMode === "split" ? "w-1/2" : "flex-1"}`}>
            <div className="max-w-3xl mx-auto px-6 py-6">
              {renderPreview()}

              {/* Visual staff notation widgets */}
              {staffDataList.length > 0 && (
                <div className="mt-6 space-y-2">
                  {staffDataList.map((staffData, idx) => (
                    <div key={idx} className="relative group">
                      <StaffNotation
                        data={staffData}
                        onChange={(newData) => handleStaffChange(idx, newData)}
                      />
                      <button
                        onClick={() => removeStaff(idx)}
                        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-xs text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 active:text-red-300 transition-colors"
                        title="Remove staff"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {drawingMode && (
              <DrawingCanvas
                strokes={drawingData}
                onChange={handleDrawingChange}
              />
            )}
          </div>
        )}

        {/* Notes panel */}
        {showNotes && (
          <div className="w-72 border-l border-border bg-card/50 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Notes</span>
              <button
                onClick={() => setShowNotes(false)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="flex-1 px-4 py-3 text-sm bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-foreground/80 placeholder:text-muted-foreground/30 leading-6"
              placeholder="Add performance notes, reminders, cues, dynamics markings..."
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-border text-[10px] text-muted-foreground/50 tracking-wide uppercase shrink-0">
        <span>{key} &middot; {tempo} bpm &middot; {timeSig}</span>
        <div className="flex items-center gap-4">
          <span>{content.split("\n").length} lines</span>
          {drawingMode && <span className="text-accent">Drawing</span>}
          <span>{viewMode === "edit" ? "Edit" : viewMode === "preview" ? "Preview" : "Split"}</span>
        </div>
      </div>
    </div>
  );
}
