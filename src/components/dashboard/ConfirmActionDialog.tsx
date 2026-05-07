'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = 'Fechar',
  confirmLabel,
  loadingLabel,
  loading = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:max-w-md sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#0D3B45]">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-relaxed text-slate-700">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 flex w-full flex-row gap-3">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-lg border-[#0D3B45] text-[#0D3B45]"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className="h-11 flex-1 rounded-lg bg-arena-button text-white hover:bg-arena-button-hover"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingLabel ?? confirmLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
