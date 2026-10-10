import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: Hi });
function Hi() { return <div>hello-trivial</div>; }
