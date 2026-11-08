"use client";

import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PublicationSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Select
      value={value || "__all"}
      onValueChange={(value) => onChange(value === "__all" ? "" : value)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className="bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value || "__all"}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Keep civil date and time together; serialize with the browser timezone only on save. */
export function PublicationDateField({
  label,
  value,
  onChange,
  disabled,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const day = value ? new Date(`${value.slice(0, 10)}T12:00:00`) : undefined;
  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="text-sm font-medium text-arena-navy-800">{label}</span>
        {optional && value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className="text-xs text-slate-500 underline underline-offset-4 hover:text-arena-navy-800"
          >
            Sem data final
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={`Data de ${label.toLowerCase()}`}
              className="h-10 min-w-0 flex-1 justify-start bg-white font-normal"
            >
              <CalendarDays className="size-4 shrink-0 text-slate-400" />
              <span className="truncate">
                {day
                  ? format(day, "dd MMM yyyy", { locale: ptBR })
                  : "Sem data final"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              labels={{
                labelNext: () => "Próximo mês",
                labelPrevious: () => "Mês anterior",
              }}
              locale={ptBR}
              selected={day}
              defaultMonth={day}
              onSelect={(date) => {
                if (date)
                  onChange(
                    `${format(date, "yyyy-MM-dd")}T${value.slice(11) || (optional ? "23:59" : "09:00")}`,
                  );
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <div className="relative w-24 shrink-0">
          <Clock3 className="pointer-events-none absolute left-2.5 top-3 size-4 text-slate-400" />
          <Input
            aria-label={`Horário de ${label.toLowerCase()}`}
            className="h-10 bg-white pl-8 tabular-nums"
            placeholder="HH:mm"
            inputMode="numeric"
            maxLength={5}
            pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
            title="Informe o horário no formato HH:mm, como 09:30"
            required={!!value}
            disabled={disabled || !value}
            value={value.slice(11)}
            onChange={(e) =>
              onChange(`${value.slice(0, 10)}T${e.target.value}`)
            }
          />
        </div>
      </div>
    </div>
  );
}
