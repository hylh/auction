export function FieldError({ message }: { message?: string | null }) {
  return message ? <span className="field-error">{message}</span> : null;
}

export function FieldHint({ preview }: { preview?: string | null }) {
  return preview ? <span className="field-hint">{preview}</span> : null;
}
