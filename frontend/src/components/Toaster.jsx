import { Toaster } from 'sonner';

export function ToasterComponent() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme="light"
      toastOptions={{
        classNameFunction: (toast) => {
          return `${toast.type === 'loading' ? 'opacity-75' : ''} rounded-lg`;
        },
      }}
    />
  );
}

// Exportar funções de notificação
export { toast } from 'sonner';
