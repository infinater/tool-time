import { useAnimatedValue } from "./useAnimatedValue";

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}

export default function AnimatedNumber({ value, format, className, duration }: Props) {
  const display = useAnimatedValue(value, duration);
  return <span className={className}>{format ? format(display) : Math.round(display)}</span>;
}
