import { useDialogStore } from '../../stores/use-dialog-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconHelpCircle,
} from '@tabler/icons-react';

export function ConfirmDialog() {
  const {
    isOpen,
    type,
    title,
    description,
    confirmText,
    cancelText,
    variant,
    promptValue,
    placeholder,
    inputType,
    errorMessage,
    setPromptValue,
    handleConfirm,
    handleCancel,
  } = useDialogStore();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  const renderIcon = () => {
    switch (variant) {
      case 'destructive':
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <IconAlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <IconAlertTriangle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            {type === 'prompt' ? <IconHelpCircle className="w-5 h-5" /> : <IconInfoCircle className="w-5 h-5" />}
          </div>
        );
    }
  };

  const confirmBtnVariant = variant === 'destructive' ? 'destructive' : 'primary';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md p-6 gap-5">
        <div className="flex items-start gap-4">
          {renderIcon()}

          <div className="space-y-1.5 flex-1">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Prompt input field */}
            {type === 'prompt' && (
              <div className="pt-3 space-y-1.5">
                <Input
                  type={inputType}
                  placeholder={placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-9 text-xs"
                  autoFocus
                />
                {errorMessage && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t-0 gap-2 sm:gap-2">
          {type !== 'alert' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-xs"
            >
              {cancelText || 'Cancel'}
            </Button>
          )}

          <Button
            type="button"
            variant={confirmBtnVariant}
            size="sm"
            onClick={handleConfirm}
            className="text-xs"
            autoFocus={type !== 'prompt'}
          >
            {confirmText || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
