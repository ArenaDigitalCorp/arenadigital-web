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
  confirmVariant?: 'default' | 'danger';
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
  confirmVariant = 'default',
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#0D3B45]">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 flex-row gap-3 sm:justify-start">
          <Button
            variant="outline"
            className="flex-1 border-[#0D3B45] text-[#0D3B45]"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={
              confirmVariant === 'danger'
                ? 'flex-1 bg-arena-button text-white hover:bg-arena-button-hover'
                : 'flex-1 bg-arena-button text-white hover:bg-arena-button-hover'
            }
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
