import { Button } from "ui";

export default function Docs() {
  return (
    <div>
      <h1>Docs</h1>
      <Button apiUrl={process.env.NEXT_PUBLIC_API_URL} />
    </div>
  );
}
