import * as Toast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { cn } from '../lib/utils';

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastViewport() {
  const toasts = useStudioStore((state) => state.toasts);
  const removeToast = useStudioStore((state) => state.removeToast);

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant];
        return (
          <Toast.Root
            key={toast.id}
            duration={toast.duration}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
            className={cn('toast-root', `toast-${toast.variant}`)}
          >
            <div className="toast-icon">
              <Icon size={17} strokeWidth={1.9} />
            </div>
            <div className="toast-copy">
              <Toast.Title className="toast-title">{toast.title}</Toast.Title>
              {toast.description ? (
                <Toast.Description className="toast-description">
                  {toast.description}
                </Toast.Description>
              ) : null}
            </div>
            <Toast.Close className="toast-close" aria-label="关闭通知">
              <X size={13} strokeWidth={2} />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="toast-viewport" label="操作通知" />
    </Toast.Provider>
  );
}
