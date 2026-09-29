import { createFileRoute } from "@tanstack/react-router";
import { HydrateClub } from "@/components/hydrate-club";
import { Studio } from "@/components/studio";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <HydrateClub>
      <Studio />
    </HydrateClub>
  );
}
