import trophy from "@/assets/berry-trophy.png";
import wave from "@/assets/berry-wave.png";
import tired from "@/assets/berry-tired.png";
import binoculars from "@/assets/berry-binoculars.png";
import clipboard from "@/assets/berry-clipboard.png";
import coach from "@/assets/berry-coach.png";

const map = { trophy, wave, tired, binoculars, clipboard, coach } as const;
export type BerryMood = keyof typeof map;

export function Berry({
  mood = "wave",
  size = 96,
  className = "",
}: {
  mood?: BerryMood;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={map[mood]}
      alt="Berry"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
