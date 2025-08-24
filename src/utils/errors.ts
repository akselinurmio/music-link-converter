export class ValidationError extends Error {
  name = "ValidationError";
}

export class APIError extends Error {
  name = "APIError";

  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
  }
}

export function getStatusCodeFromError(error: unknown): number {
  if (error instanceof ValidationError) {
    return 400;
  } else if (error instanceof APIError) {
    return error.statusCode;
  } else if (
    error instanceof Error &&
    (error.message.includes("429") || error.message.includes("rate limit"))
  ) {
    return 429;
  } else {
    return 500;
  }
}
