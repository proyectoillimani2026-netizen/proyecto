import { PaymentReturn } from "@/components/PaymentReturn";

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ result: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { result } = await params;
  const query = await searchParams;
  const one = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || "";
  return <PaymentReturn result={result} orderId={one(query.order)} paymentId={one(query.payment_id) || one(query.collection_id)} />;
}
