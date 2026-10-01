/* A template, unlike a layout, mounts afresh on every navigation, so each sign-up and log-in page fades in the same
   way the steps of the sign-up overlay do -- moving from one of these pages to the next never jumps. */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="signup-fade-in">{children}</div>;
}
