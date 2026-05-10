import Image from 'next/image';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Valores padrão do layout “Espaços” — use em outras telas com spread parcial. */
export const GRADIENT_MEDIA_CARD_DEFAULTS = {
  width: 376,
  height: 217,
  imageHeight: 109,
  imageInnerWidth: 382,
} as const;

/** Preset para cards de estação (376×271, imagem em largura total). */
export const GRADIENT_MEDIA_CARD_STATION_PRESET = {
  ...GRADIENT_MEDIA_CARD_DEFAULTS,
  height: 271,
  imageInnerWidth: 376,
} as const;

export type GradientMediaCardProps = {
  imageSrc: string;
  imageAlt: string;
  /** Conteúdo textual / métricas na faixa do gradiente, alinhado ao topo à esquerda */
  children: ReactNode;
  /** Ações no canto inferior direito (ex.: menu com MoreVertical) */
  actions?: ReactNode;
  /** Opcional: badge ou chip no canto superior direito */
  badge?: ReactNode;
  /** Largura do card em px */
  width?: number;
  /** Altura total do card em px */
  height?: number;
  /** Altura da faixa de imagem no topo em px */
  imageHeight?: number;
  /** Largura interna da imagem (centralizada; excedente é cortado pelo overflow) */
  imageInnerWidth?: number;
  /**
   * Largura 100% do pai — use em grid com `minmax(..., 1fr)` para preencher a linha.
   */
  fluid?: boolean;
  className?: string;
  /** Classes extras na área da imagem (ex.: group-hover) */
  imageClassName?: string;
  /** Quando true, véu escuro sobre o card (ex.: espaço inativo) — `arena-charcoal` a 50% */
  inactive?: boolean;
  /** Clique no card (área fora de menu/ações). Ex.: abrir modal ou navegar. */
  onClick?: () => void;
  /** Rótulo acessível quando `onClick` está definido */
  ariaLabel?: string;
  /**
   * `top`: conteúdo logo abaixo da imagem (espaços).
   * `bottom`: conteúdo no canto inferior esquerdo, coluna com `gap-2` (estações).
   */
  contentLayout?: 'top' | 'bottom';
};

/**
 * Card com gradiente laranja/amarelo, imagem no topo e conteúdo na faixa inferior.
 * `contentLayout="top"`: texto abaixo da imagem (espaços).
 * `contentLayout="bottom"`: coluna no canto inferior esquerdo com `gap-2` (estações).
 */
export function GradientMediaCard({
  imageSrc,
  imageAlt,
  children,
  actions,
  badge,
  width = GRADIENT_MEDIA_CARD_DEFAULTS.width,
  height = GRADIENT_MEDIA_CARD_DEFAULTS.height,
  imageHeight = GRADIENT_MEDIA_CARD_DEFAULTS.imageHeight,
  imageInnerWidth = GRADIENT_MEDIA_CARD_DEFAULTS.imageInnerWidth,
  fluid = false,
  className,
  imageClassName,
  inactive = false,
  onClick,
  ariaLabel,
  contentLayout = 'top',
}: GradientMediaCardProps) {
  const rootStyle = (
    fluid
      ? { height, width: '100%' }
      : { width, height }
  ) satisfies CSSProperties;

  const imageStripStyle = {
    height: imageHeight,
  } satisfies CSSProperties;

  const imageFullBleed = fluid || imageInnerWidth >= width;

  const imageInnerStyle = {
    width: imageInnerWidth,
    height: imageHeight,
  } satisfies CSSProperties;

  const fadeStyle = {
    top: imageHeight,
  } satisfies CSSProperties;

  const contentStyleTop = {
    top: imageHeight,
  } satisfies CSSProperties;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#F97415_0%,#F9A91F_45%,#FCE38A_100%)] font-sans text-white shadow-lg',
        fluid ? 'min-w-0 w-full' : 'shrink-0',
        onClick &&
          'cursor-pointer transition-[filter] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        className
      )}
      style={rootStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
    >
        <div
        className="relative overflow-hidden rounded-t-[8px]"
        style={imageStripStyle}
      >
        <div
          className={cn(
            imageFullBleed
              ? 'absolute inset-x-0 top-0'
              : 'absolute left-1/2 top-0 -translate-x-1/2',
            imageClassName
          )}
          style={
            imageFullBleed
              ? { height: imageHeight }
              : imageInnerStyle
          }
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes={
              fluid
                ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                : `${imageInnerWidth}px`
            }
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(249,116,21,0)_0%,rgba(249,116,21,0.35)_100%)]"
        style={fadeStyle}
      />

      {contentLayout === 'bottom' ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-row items-end justify-between gap-3 px-[23px] pb-[17px] pt-1">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-1">{children}</div>
          {actions != null ? (
            <div
              className="flex shrink-0 items-end pb-px"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className={cn(
              'absolute left-0 z-1 max-w-[min(100%,280px)] px-[23px] py-[17px]'
            )}
            style={contentStyleTop}
          >
            {children}
          </div>

          {actions != null && (
            <div
              className="absolute bottom-[17px] right-[23px] z-20 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </>
      )}

      {badge != null && (
        <div
          className="absolute right-[23px] top-[17px] z-20 flex justify-end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {badge}
        </div>
      )}

      {inactive ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-[8px] bg-arena-charcoal/50"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
