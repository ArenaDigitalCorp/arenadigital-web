import { cn } from '@/lib/utils';

interface DashboardTabItem<TValue extends string> {
  label: string;
  value: TValue;
}

interface DashboardTabsProps<TValue extends string> {
  tabs: DashboardTabItem<TValue>[];
  value: TValue;
  onChange?: (value: TValue) => void;
  className?: string;
}

export function DashboardTabs<TValue extends string>({
  tabs,
  value,
  onChange,
  className,
}: DashboardTabsProps<TValue>) {
  return (
    <div
      className={cn(
        'flex items-center gap-8 border-b border-arena-navy-800/10',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange?.(tab.value)}
            className={cn(
              'relative pb-4 text-sm font-bold transition-colors',
              active ? 'text-arena-navy-800' : 'text-[#007793]'
            )}
          >
            {tab.label}
            {active && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-[calc(100%+32px)] -translate-x-1/2 bg-[#20B2AA]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
