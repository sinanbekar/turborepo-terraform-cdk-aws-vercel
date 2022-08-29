import { Button } from "ui";

export default function Web() {
  return (
    <div>
      <h1>Web</h1>
      <Button apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/'} />
    </div>
  );
}
