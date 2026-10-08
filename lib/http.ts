import { HttpError } from "./orders";

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const status = (error as { status?: number }).status;
  if (status === 401) {
    return Response.json({ error: error instanceof Error ? error.message : "No autorizado" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Error inesperado";
  return Response.json({ error: message }, { status: 500 });
}
