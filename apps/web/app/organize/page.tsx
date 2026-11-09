import { ConferencePicker } from "../../src/components/conference-picker";
export const metadata = { title: "Your conferences" };
export default function Page() {
  return <ConferencePicker mode="organize" />;
}
