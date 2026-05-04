import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Hook customizado para formulários com validação Zod
 * @param {ZodSchema} schema - Schema Zod para validação
 * @param {Object} defaultValues - Valores padrão do formulário
 * @returns {Object} - Retorna métodos do react-hook-form
 */
export function useFormValidation(schema, defaultValues = {}) {
  return useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });
}

/**
 * Hook para validação de campos específicos
 */
export function useFieldValidation(schema, fieldName) {
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  return {
    register: form.register(fieldName),
    error: form.formState.errors[fieldName],
    isDirty: form.formState.dirtyFields[fieldName],
  };
}
