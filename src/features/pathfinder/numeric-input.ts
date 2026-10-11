/** Signed numeric components only. Preserve a transient lone sign while typing.
 * Restrict before state updates as well as paste/IME, never just inputMode.
 */
export function signedNumericInput(value:string):boolean {
  return /^[+-]?\d*$/.test(value);
}
export function sanitizeSignedNumericInput(value:string):string {
  const normalized=value.replace(/[−–—]/g,'-').replace(/[＋]/g,'+');
  if(signedNumericInput(normalized))return normalized;
  return normalized.replace(/[^0-9+-]/g,'').replace(/(?!^)[+-]/g,'').replace(/^([+-])([+-])+/,'$1');
}
