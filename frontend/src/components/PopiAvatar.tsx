/* Popi, the one mascot: a little robot that floats in the air wherever he speaks or helps. */
export default function PopiAvatar({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small transparent cut-out
    <img
      src="/popi/popi.png"
      alt=""
      aria-hidden="true"
      width={Math.round((size * 209) / 320)}
      height={size}
      className={`popi-float pointer-events-none select-none drop-shadow-[0_6px_8px_rgba(0,0,0,0.18)] ${className}`}
      style={{ height: size, width: 'auto' }}
    />
  );
}
