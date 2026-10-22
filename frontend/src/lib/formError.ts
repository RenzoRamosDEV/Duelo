/** A form's error message and the input it is about (`null` when it is about no single field). */
export interface FormError<Field extends string> {
  text: string;
  field: Field | null;
}
