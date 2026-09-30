import Game from "@/components/Game";
import { getDaily } from "@/lib/daily";
import { listQuestions } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const questions = await listQuestions();
  const daily = await getDaily(questions);
  return <Game questions={questions} daily={daily} />;
}
