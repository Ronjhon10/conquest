import { ConferencePicker } from "../../src/components/conference-picker";
export const metadata = { title: "Pick your conference" };
export default function Page() {
  return <ConferencePicker mode="play" />;
}
