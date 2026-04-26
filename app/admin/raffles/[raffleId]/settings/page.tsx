import { RaffleSettings } from "../../../../components/RaffleSettings";

export default async function EditRafflePage({ params }: { params: Promise<{ raffleId: string }> }) {
  const { raffleId } = await params;
  return <RaffleSettings mode="edit" raffleId={raffleId} />;
}
