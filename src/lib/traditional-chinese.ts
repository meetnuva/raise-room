import { Converter } from "opencc-js/cn2t";

const convert = Converter({ from: "cn", to: "tw" });

export function toTaiwanTraditional(text: string): string {
  return convert(text);
}
