import { SpeakerView } from "../../../src/components/speaker";
export const metadata = { title: "Speaker recognition" };
type Props = { params: Promise<{ speaker: string }> };
export default async function Page({ params }: Props) {
  const { speaker } = await params;
  return (
    <div className="page-container">
      <SpeakerView speakerId={speaker} />
    </div>
  );
}
