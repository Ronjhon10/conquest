import { ActionLink, PageHeading } from "../../../../src/components/ui";
export const metadata = { title: "LinkedIn sign-in expired" };
export default function LinkedinError() {
  return (
    <div className="page-container">
      <PageHeading eyebrow="LinkedIn sign-in" title="Let’s try that again">
        Your sign-in expired or couldn’t be verified. Reopen your conference’s
        signup link to try again. You can also enter your details and choose a
        photo yourself.
      </PageHeading>
      <ActionLink href="/">Return to Conquest</ActionLink>
    </div>
  );
}
