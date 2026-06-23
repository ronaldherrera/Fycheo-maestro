export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
