// Numbers drawn via CSS instead of text nodes, so mobile browsers' address/
// phone detection doesn't read "25 Doğru 1 Yanlış" as a street address.
export default function Num({ value }: { value: string | number }) {
  return <span className="pp-num" data-v={value} role="img" aria-label={String(value)} />;
}
