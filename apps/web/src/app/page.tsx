import { Button, Panel } from "@gb/ui";

export default function Home() {
  return (
    <main className="p-8">
      <Panel>
        <p className="font-mono text-amber-ink">181.6 Hz</p>
        <Button>Start</Button>
      </Panel>
    </main>
  );
}
