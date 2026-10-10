import { createFileRoute } from "@tanstack/react-router";
import { LineChart, Line } from "recharts";
export const Route = createFileRoute("/")({ component: Hi });
function Hi() { return <LineChart width={300} height={200} data={[{a:1},{a:2}]}><Line dataKey="a" /></LineChart>; }
