import {
  useId,
  useMemo,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import katex from 'katex';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function Formula({
  latex,
  className,
  display = false,
}: {
  latex: string;
  className?: string;
  display?: boolean;
}) {
  const html = useMemo(() => {
    if (!latex) return '';
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: display,
        strict: false,
        trust: false,
        output: 'html',
      });
    } catch {
      return '';
    }
  }, [latex, display]);

  if (!html) {
    return <span className={cn('formula-empty', className)}>—</span>;
  }

  return (
    <span
      className={cn('formula-render', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function EquationField({
  label,
  value,
  onChange,
  placeholder,
  previewLatex,
  error,
  hint,
  multiline = false,
  disabled = false,
  trailing,
  id: providedId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  previewLatex?: string;
  error?: string | null;
  hint?: string;
  multiline?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  id?: string;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className={cn('equation-field', error && 'has-error')}>
      <div className="field-heading">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {trailing}
      </div>
      {multiline ? (
        <textarea
          id={id}
          className="equation-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          rows={3}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          className="equation-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
        />
      )}
      <div className={cn('formula-preview', error && 'is-invalid')}>
        <span className="formula-preview-label">PREVIEW</span>
        {error ? (
          <span className="formula-inline-error">{error}</span>
        ) : (
          <Formula latex={previewLatex ?? '\text{输入方程后显示预览}'} />
        )}
      </div>
      {!error && hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function NumericField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  className,
  inputClassName,
  disabled,
  invalid,
  inputMode = 'decimal',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  invalid?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className={cn('field', className)}>
      {label ? <span className="field-label">{label}</span> : null}
      <span className={cn('input-wrap', invalid && 'is-invalid')}>
        <input
          className={cn('text-input', inputClassName)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function AxisField({
  axis,
  value,
  onChange,
}: {
  axis: 'x' | 'y' | 'z';
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cn('axis-field', `axis-${axis}`)}>
      <span className="axis-letter">{axis.toUpperCase()}</span>
      <input
        className="axis-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        spellCheck={false}
        autoComplete="off"
      />
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  swatch?: string;
  disabled?: boolean;
}

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = '请选择',
  ariaLabel,
  className,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value ?? ''} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn('select-trigger', className)}
        aria-label={ariaLabel}
      >
        <SelectPrimitive.Value placeholder={<span className="select-placeholder">{placeholder}</span>} />
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={14} strokeWidth={1.8} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="select-item"
              >
                <SelectPrimitive.ItemText>
                  <span className="select-item-main">
                    {option.swatch ? (
                      <span
                        className="select-swatch"
                        style={{ backgroundColor: option.swatch }}
                      />
                    ) : null}
                    <span>{option.label}</span>
                    {option.hint ? <span className="select-item-hint">{option.hint}</span> : null}
                  </span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-indicator">
                  <Check size={13} strokeWidth={2.2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  glyph?: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn('segmented', className)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cn('segmented-button', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
          disabled={option.disabled}
          title={option.hint}
        >
          {option.glyph ? <span className="segmented-glyph">{option.glyph}</span> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('switch-row', disabled && 'is-disabled')}>
      <label className="switch-copy" htmlFor={id}>
        <span className="switch-label">{label}</span>
        {description ? <span className="switch-description">{description}</span> : null}
      </label>
      <SwitchPrimitive.Root
        id={id}
        className="switch-root"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <SwitchPrimitive.Thumb className="switch-thumb" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export function RangeSlider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step = 0.01,
  ariaLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
}) {
  return (
    <SliderPrimitive.Root
      className="slider-root"
      value={[value]}
      onValueChange={([next]) => onValueChange(next)}
      min={min}
      max={max}
      step={step}
    >
      <SliderPrimitive.Track className="slider-track">
        <SliderPrimitive.Range className="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="slider-thumb" aria-label={ariaLabel} />
    </SliderPrimitive.Root>
  );
}

export function TooltipButton({
  label,
  onClick,
  children,
  className,
  disabled,
  type = 'button',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <TooltipPrimitive.Root delayDuration={280}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type={type}
          className={cn('icon-button', className)}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tooltip-content" sideOffset={8}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Modal({
  open,
  onOpenChange,
  title,
  kicker,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className={cn('dialog-content', className)}>
          <div className="dialog-header">
            <div>
              {kicker ? <div className="dialog-kicker">{kicker}</div> : null}
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close className="icon-button dialog-close" aria-label="关闭">
              <X size={16} strokeWidth={1.8} />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            应用对话框内容
          </DialogPrimitive.Description>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-footer">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SectionHeading({
  index,
  title,
  kicker,
  trailing,
}: {
  index: string;
  title: string;
  kicker?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <span className="section-index">{index}</span>
      <div className="section-title-wrap">
        <h2 className="section-title">{title}</h2>
        {kicker ? <span className="section-kicker">{kicker}</span> : null}
      </div>
      {trailing ? <div className="section-trailing">{trailing}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      <p className="empty-description">{description}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
