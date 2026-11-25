'use client';

import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {label ? (
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-txt-dim">{label}</div>
          {desc ? <div className="mt-0.5 text-[11.5px] leading-relaxed text-txt-mute">{desc}</div> : null}
        </div>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-[3px] h-[19px] w-[34px] shrink-0 rounded-full border transition-colors duration-200',
          checked
            ? 'border-brand/60 bg-[linear-gradient(97deg,#4d8dff,#7b5cff)]'
            : 'border-ink-line2 bg-[#0e131a]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white shadow transition-all duration-200',
            checked ? 'left-[17px]' : 'left-[2px]'
          )}
        />
      </button>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[3px] w-full cursor-pointer appearance-none rounded-full bg-ink-line2 accent-[#7b5cff]"
      />
      <span className="w-[52px] shrink-0 text-right font-mono text-[11.5px] text-txt-dim">
        {value}
        {suffix}
      </span>
    </div>
  );
}
